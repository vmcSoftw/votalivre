import {readFileSync} from 'node:fs';
import {verifyCommitteeCertificate} from '../lib/committee.js';
const [certificatePath,sealPublicPath,rosterPath]=process.argv.slice(2);
if(!rosterPath)throw Error('Uso: node scripts/committee-verify.mjs <certificado.json> <chave-lacracao-confiada.pem> <lista-confiada-antes-do-pleito.json>');
const check=verifyCommitteeCertificate({certificate:JSON.parse(readFileSync(certificatePath,'utf8')),trustedSealKeyPem:readFileSync(sealPublicPath,'utf8'),trustedRoster:JSON.parse(readFileSync(rosterPath,'utf8'))});
process.stdout.write(JSON.stringify({status:'ENDOSSOS DA COMISSÃO VÁLIDOS — não é certificação de ausência de fraude',...check},null,2)+'\n');
