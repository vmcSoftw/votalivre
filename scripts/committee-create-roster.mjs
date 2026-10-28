import {readFileSync,writeFileSync} from 'node:fs';
import {createCommitteeRoster,committeeRosterFingerprint} from '../lib/committee.js';
const [id,n,out,...members]=process.argv.slice(2);
if(!id||!n||!out||members.length<2)throw Error('Uso: node scripts/committee-create-roster.mjs <election-uuid> <min-assinaturas> <saida.json> <id:nome:caminho-publica.pem>...');
const entries=members.map(s=>{const [id,name,...path]=s.split(':');if(!id||!name||path.length===0)throw Error('Formato de membro inválido');return {id,name,publicKeyPem:readFileSync(path.join(':'),'utf8')};});
const roster=createCommitteeRoster(id,Number(n),entries);
writeFileSync(out,JSON.stringify(roster,null,2),{flag:'wx',mode:0o644});
process.stdout.write(`Lista criada: ${out}\nIMPRIMA E CONFIRA POR CANAL EXTERNO antes da eleição:\nSHA-256 da lista: ${committeeRosterFingerprint(roster)}\n`);
