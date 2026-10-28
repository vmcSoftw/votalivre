import {readFileSync} from 'node:fs';
import {db} from '../lib/db.js';
import {decryptChoice} from '../lib/crypto.js';
import {assembleManifest,signManifest} from '../lib/audit.js';
const id=process.argv[2],keyfile=process.argv[3];
if(!/^[a-f0-9-]{36}$/i.test(id||'')||!keyfile)throw Error('Uso: npm run audit:seal -- <election-uuid> <caminho-chave-privada.pem>');
const signer=readFileSync(keyfile,'utf8');
const sql=db();
try{
 const result=await sql.begin(async tx=>{
  const [e]=await tx`SELECT * FROM elections WHERE id=${id} FOR UPDATE`;
  if(!e)throw Error('Eleição não encontrada');
  if(e.ends_at.getTime()>=Date.now())throw Error('Aguardar encerramento: não é permitido lacrar votação aberta');
  const [sealed]=await tx`SELECT election_id FROM audit_snapshots WHERE election_id=${id}`;
  if(sealed)throw Error('Eleição já lacrada. Não é permitido recriar o manifesto.');
  const options=await tx`SELECT id,label,kind,position FROM ballot_options WHERE election_id=${id} ORDER BY position`;
  const ballots=await tx`SELECT encrypted_choice FROM ballots WHERE election_id=${id}`;
  const receipts=await tx`SELECT receipt_hash FROM ballot_receipts WHERE election_id=${id}`;
  const [tokens]=await tx`SELECT COUNT(*)::int AS issued, COUNT(*) FILTER(WHERE used_at IS NOT NULL)::int AS used FROM voter_tokens WHERE election_id=${id}`;
  const [roster]=await tx`SELECT COUNT(*)::int AS eligible FROM eligible_voters WHERE election_id=${id}`;
  if(roster.eligible>0&&tokens.issued>roster.eligible)throw Error('Credenciais emitidas superam os eleitores aptos');
  if(e.quorum_percent>0&&roster.eligible===0)throw Error('Quórum configurado sem lista de aptos: não é possível lacrar um resultado sem base de elegibilidade verificável');
  const manifest=assembleManifest({election:e,options,encryptedBallots:ballots.map(x=>x.encrypted_choice),receiptHashes:receipts.map(x=>x.receipt_hash),issued:tokens.issued,used:tokens.used,decrypt:decryptChoice,createdAt:new Date(),governance:{eligible:roster.eligible,minimumPercent:e.quorum_percent,tieRule:e.tie_rule}});
  const signature=signManifest(manifest,signer);
  await tx`INSERT INTO audit_snapshots(election_id,manifest_text,signature_base64url,public_key_pem) VALUES(${id},${signature.manifestText},${signature.signature},${signature.publicKeyPem})`;
  return {votes:manifest.totals.ballots,signature:signature.signature,root:manifest.commitments.ballotsRoot};
 });
 process.stdout.write(`Eleição lacrada: ${id}\nVotos: ${result.votes}\nRaiz das cédulas: ${result.root}\nPUBLIQUE esta impressão também fora do VotaLivre.\n`);
}finally{await sql.end();}
