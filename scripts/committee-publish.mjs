import {readFileSync} from 'node:fs';
import {verifyCommitteeCertificate} from '../lib/committee.js';
import {db} from '../lib/db.js';
const [certificatePath,sealPublicPath,rosterPath]=process.argv.slice(2);
if(!rosterPath)throw Error('Uso: node scripts/committee-publish.mjs <certificado.json> <chave-lacracao-confiada.pem> <lista-previamente-confiada.json>');
const certificateText=readFileSync(certificatePath,'utf8');
if(Buffer.byteLength(certificateText)>1_000_000)throw Error('Certificado muito grande');
const certificate=JSON.parse(certificateText),sealKey=readFileSync(sealPublicPath,'utf8'),roster=JSON.parse(readFileSync(rosterPath,'utf8'));
const check=verifyCommitteeCertificate({certificate,trustedSealKeyPem:sealKey,trustedRoster:roster});
const sql=db();
try{
 await sql.begin(async tx=>{
  const [snap]=await tx`SELECT manifest_text,signature_base64url,public_key_pem FROM audit_snapshots WHERE election_id=${check.electionId}`;
  if(!snap||snap.manifest_text!==certificate.attestation.manifestText||snap.signature_base64url!==certificate.attestation.signature||snap.public_key_pem!==certificate.attestation.publicKeyPem)throw Error('Certificado não corresponde à lacração registrada no banco');
  await tx`INSERT INTO committee_certificates (election_id,certificate_text) VALUES (${check.electionId},${JSON.stringify(certificate)})`;
 });
 process.stdout.write(`Publicado: ${check.electionId}. Assinaturas válidas: ${check.approved.length}/${check.required}. Registre uma cópia independente do certificado.\n`);
}finally{await sql.end();}
