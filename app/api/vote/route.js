import {db} from '@/lib/db';
import {limitPublicVote} from '@/lib/limits';
import {postGuard,limitedJSON,asError,PublicError,tokenDigest,voterPinDigest,sha256,makeReceipt,encryptChoice} from '@/lib/security';
export const runtime='nodejs';
const safeToken=token=>/^[A-Za-z0-9_-]{43}$/.test(token);
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export async function POST(req){
 try{
  postGuard(req);
  const {electionId,optionId,token,pin}=await limitedJSON(req);
  if(!UUID.test(electionId||'')||!UUID.test(optionId||'')||typeof token!=='string'||!safeToken(token)||!/^[0-9]{10}$/.test(pin||''))throw new PublicError('Dados de votação inválidos.');
  const normalizedToken=token,receipt=makeReceipt(),hashed=tokenDigest(normalizedToken),pinHash=voterPinDigest(electionId,normalizedToken,pin);
  // Não armazenar lixo em voter_auth_attempts para IDs de eleições inexistentes/inativas.
  const [active]=await db()`SELECT id FROM elections WHERE id=${electionId} AND starts_at<=NOW() AND ends_at>NOW()`;
  if(!active)throw new PublicError('Votação indisponível neste momento.',409);
  const sql=db();
  await limitPublicVote(sql,req,electionId);
  // Só criar contador por credencial se o token realmente foi emitido.
  const [issued]=await sql`SELECT id FROM voter_tokens WHERE election_id=${electionId} AND token_hash=${hashed} AND used_at IS NULL AND revoked_at IS NULL`;
  if(!issued)throw new PublicError('Credencial ou código inválido, ou credencial já utilizada.',409);
  // Controle por credencial persiste entre reinícios e réplicas; não guardar IP nem opção de voto.
  const [attempt]=await sql`
   INSERT INTO voter_auth_attempts(token_hash,election_id,window_start,failures)
   VALUES(${hashed},${electionId},NOW(),1)
   ON CONFLICT(token_hash) DO UPDATE SET
    failures=CASE WHEN voter_auth_attempts.window_start < NOW()-INTERVAL '15 minutes' THEN 1 ELSE voter_auth_attempts.failures+1 END,
    window_start=CASE WHEN voter_auth_attempts.window_start < NOW()-INTERVAL '15 minutes' THEN NOW() ELSE voter_auth_attempts.window_start END
   RETURNING failures`;
  if(attempt.failures>6)throw new PublicError('Muitas tentativas. Aguarde 15 minutos.',429);
  await db().begin(async tx=>{
   const [e]=await tx`SELECT id FROM elections WHERE id=${electionId} AND starts_at <= NOW() AND ends_at > NOW() FOR SHARE`;
   if(!e)throw new PublicError('Votação indisponível neste momento.',409);
   const [option]=await tx`SELECT id FROM ballot_options WHERE id=${optionId} AND election_id=${electionId}`;
   if(!option)throw new PublicError('Opção inválida.',400);
   const [valid]=await tx`UPDATE voter_tokens SET used_at=NOW() WHERE election_id=${electionId} AND token_hash=${hashed} AND pin_hash=${pinHash} AND used_at IS NULL AND revoked_at IS NULL RETURNING id`;
   if(!valid)throw new PublicError('Credencial ou código inválido, ou credencial já utilizada.',409);
   // A escolha cifrada não contém identificador do eleitor ou do token.
   await tx`INSERT INTO ballots(election_id,encrypted_choice) VALUES(${electionId},${encryptChoice(electionId,optionId)})`;
   await tx`INSERT INTO ballot_receipts(election_id,receipt_hash) VALUES(${electionId},${sha256(receipt)})`;
   await tx`DELETE FROM voter_auth_attempts WHERE token_hash=${hashed}`;
  });
  return Response.json({ok:true,receipt},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return asError(e)}
}
