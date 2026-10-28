import {readFileSync,writeFileSync} from 'node:fs';
import {createCommitteeCertificate,verifyCommitteeCertificate} from '../lib/committee.js';
const [attPath,sealPublicPath,rosterPath,out,...approvals]=process.argv.slice(2);
if(!out||approvals.length<2)throw Error('Uso: node scripts/committee-build-certificate.mjs <manifesto-publico.json> <chave-lacracao-confiada.pem> <lista-confiada.json> <saida-certificado.json> <aprovacao1.json> <aprovacao2.json>...');
const certificate=createCommitteeCertificate(JSON.parse(readFileSync(attPath,'utf8')),JSON.parse(readFileSync(rosterPath,'utf8')),approvals.map(p=>JSON.parse(readFileSync(p,'utf8'))));
const result=verifyCommitteeCertificate({certificate,trustedSealKeyPem:readFileSync(sealPublicPath,'utf8'),trustedRoster:certificate.roster});
writeFileSync(out,JSON.stringify(certificate,null,2),{flag:'wx',mode:0o644});
process.stdout.write(`Certificado criado com ${result.approved.length} endossos válidos. Distribua a lista confiada previamente; não basta confiar na lista dentro do certificado.\n`);
