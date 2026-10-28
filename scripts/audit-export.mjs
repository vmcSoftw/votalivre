import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {db} from '../lib/db.js';
import {deriveElectionKey} from '../lib/crypto.js';
import {ballotCommitment,verifyManifest} from '../lib/audit.js';
const id=process.argv[2],out=process.argv[3];
if(!/^[a-f0-9-]{36}$/i.test(id||'')||!out)throw Error('Uso: npm run audit:export -- <election-uuid> <diretorio-seguro>');
const sql=db();
try{
 const [s]=await sql`SELECT manifest_text,signature_base64url,public_key_pem FROM audit_snapshots WHERE election_id=${id}`;
 if(!s)throw Error('Eleição ainda não lacrada');
 if(!verifyManifest(s.manifest_text,s.signature_base64url,s.public_key_pem))throw Error('Assinatura do manifesto inválida');
 const ballots=await sql`SELECT encrypted_choice FROM ballots WHERE election_id=${id}`;
 const encryptedBallots=ballots.map(b=>b.encrypted_choice).sort((a,b)=>ballotCommitment(id,a).localeCompare(ballotCommitment(id,b)));
 const attestation={manifestText:s.manifest_text,signature:s.signature_base64url,publicKeyPem:s.public_key_pem};
 const bundle={schema:'votalivre-commission-bundle-v1',attestation,encryptedBallots,electionKeyHex:deriveElectionKey(id).toString('hex')};
 const folder=resolve(out);mkdirSync(folder,{recursive:true,mode:0o700});
 writeFileSync(join(folder,`${id}.public.json`),JSON.stringify(attestation,null,2),{flag:'wx',mode:0o644});
 writeFileSync(join(folder,`${id}.CONFIDENCIAL.json`),JSON.stringify(bundle,null,2),{flag:'wx',mode:0o600});
 process.stdout.write(`Exportação: ${folder}\nO arquivo CONFIDENCIAL contém uma chave da eleição e NÃO deve ser publicado.\n`);
}finally{await sql.end();}
