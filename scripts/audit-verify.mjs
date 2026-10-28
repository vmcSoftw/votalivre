import {readFileSync} from 'node:fs';
import {verifyAuditBundle} from '../lib/audit.js';
const [bundlePath,trustedPublicKeyPath]=process.argv.slice(2);
if(!bundlePath||!trustedPublicKeyPath)throw Error('Uso: npm run audit:verify -- <pacote-confidencial.json> <chave-publica-registrada-previamente.pem>');
const bundle=JSON.parse(readFileSync(bundlePath,'utf8'));
const key=readFileSync(trustedPublicKeyPath,'utf8');
const result=verifyAuditBundle(bundle,key);
process.stdout.write(JSON.stringify({status:'CONFERÊNCIA CONSISTENTE (não certifica identidade nem ausência de fraude anterior à lacração)',...result},null,2)+'\n');
