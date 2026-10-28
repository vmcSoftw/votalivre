import {readFileSync,writeFileSync} from 'node:fs';
import {createCommitteeApproval} from '../lib/committee.js';
const [bundlePath,sealPubPath,rosterPath,memberId,memberPrivatePath,out]=process.argv.slice(2);
if(!out)throw Error('Uso: node scripts/committee-approve.mjs <pacote-CONFIDENCIAL.json> <chave-lacracao-confiada.pem> <lista-comissao.json> <id-auditor> <chave-privada.pem> <saida-aprovacao.json>');
const approval=createCommitteeApproval({bundle:JSON.parse(readFileSync(bundlePath,'utf8')),trustedSealKeyPem:readFileSync(sealPubPath,'utf8'),roster:JSON.parse(readFileSync(rosterPath,'utf8')),auditorId:memberId,privateKeyPem:readFileSync(memberPrivatePath,'utf8')});
writeFileSync(out,JSON.stringify(approval,null,2),{flag:'wx',mode:0o644});
process.stdout.write(`Endosso assinado pelo auditor ${memberId}. Publicar SOMENTE o arquivo de aprovação. Nunca publique pacote confidencial ou chave privada.\n`);
