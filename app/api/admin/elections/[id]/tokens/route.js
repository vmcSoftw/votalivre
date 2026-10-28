import {randomUUID} from 'node:crypto';
import {db} from '@/lib/db';
import {encryptPinBatch} from '@/lib/issuance';
import {adminContext,makeToken,makeVoterPin,tokenDigest,voterPinDigest,postGuard,limitedJSON,asError,PublicError} from '@/lib/security';
export const runtime='nodejs';
export async function POST(req,context){
 try{
  postGuard(req);const admin=await adminContext(req.cookies.get('admin_session')?.value);
  if(!admin)throw new PublicError('Acesso não autorizado',401);
  if(admin.role==='auditor')throw new PublicError('Ação restrita a gestores',403);
  const {id}=await context.params,{quantity}=await limitedJSON(req);
  if(!Number.isInteger(quantity)||quantity<1||quantity>300)throw new PublicError('Gere entre 1 e 300 credenciais por lote.');
  const sql=db();
  const [second]=await sql`SELECT id FROM admin_users WHERE organization_id=${admin.organization_id} AND active=TRUE AND role IN ('owner','manager') AND id<>${admin.id} LIMIT 1`;
  if(!second)throw new PublicError('Cadastre um segundo gestor habilitado para entregar os códigos de confirmação.',409);
  const data=await sql.begin(async tx=>{
   const [e]=await tx`SELECT id,quorum_percent FROM elections WHERE id=${id} AND organization_id=${admin.organization_id} AND starts_at > NOW() FOR UPDATE`;
   if(!e)throw new PublicError('Eleição inexistente, de outra organização ou já iniciada.',409);
   // Bloqueio da eleição serializa emissões concorrentes e limita credenciais ativas.
   const [current]=await tx`SELECT COUNT(*)::int AS issued FROM voter_tokens WHERE election_id=${id} AND revoked_at IS NULL`;
   const [roster]=await tx`SELECT COUNT(*)::int AS eligible FROM eligible_voters WHERE election_id=${id}`;
   if(e.quorum_percent>0&&roster.eligible===0)throw new PublicError('Cadastre eleitores aptos para calcular o quórum desta eleição antes de emitir credenciais.',409);
   if(roster.eligible>0&&current.issued+quantity>roster.eligible)throw new PublicError('A quantidade de credenciais ultrapassaria a lista de eleitores aptos.',409);
   if(current.issued+quantity>10000)throw new PublicError('Limite do protótipo: no máximo 10 mil credenciais ativas por eleição.',409);
   const batchId=randomUUID(),tokens=[],pins=[];
   for(let i=0;i<quantity;i++){
    const token=makeToken(),pin=makeVoterPin();tokens.push(token);pins.push(pin);
   }
   const ciphertext=encryptPinBatch(batchId,id,pins);
   await tx`INSERT INTO issue_batches(id,election_id,created_by,pins_ciphertext,quantity) VALUES(${batchId},${id},${admin.id},${ciphertext},${quantity})`;
   for(let i=0;i<quantity;i++){
    await tx`INSERT INTO voter_tokens(election_id,issue_batch_id,token_hash,pin_hash) VALUES(${id},${batchId},${tokenDigest(tokens[i])},${voterPinDigest(id,tokens[i],pins[i])})`;
   }
   await tx`INSERT INTO admin_activity(organization_id,election_id,actor_id,action,detail) VALUES(${admin.organization_id},${id},${admin.id},'token_batch_created',${`${quantity} credenciais no lote ${batchId}`})`;
   return {batchId,tokens};
  });
  // O emissor recebe apenas as credenciais; outro gestor recebe os PINs.
  return Response.json(data,{headers:{'Cache-Control':'no-store'}});
 }catch(e){return asError(e)}
}
