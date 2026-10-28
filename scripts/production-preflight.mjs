/** Checagem sem mostrar segredos: reprova configuração insegura. */
import {readTrustAnchor} from '../lib/trust-anchors.js';
const problems=[];
const hex=/^[0-9a-fA-F]{64}$/;
for(const key of ['BALLOT_ENCRYPTION_KEY','TOKEN_PEPPER','VOTER_PIN_PEPPER','LOGIN_RATE_SECRET','MFA_ENCRYPTION_KEY','ISSUANCE_ENCRYPTION_KEY','ROSTER_PROTECTION_KEY']){
 if(!hex.test(process.env[key]||''))problems.push(`${key}: ausente ou formato inválido`);
}
let origin;
try{origin=new URL(process.env.APP_ORIGIN||'');if(origin.protocol!=='https:')problems.push('APP_ORIGIN deve usar HTTPS em produção');}catch{problems.push('APP_ORIGIN inválida');}
if(!/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL||''))problems.push('DATABASE_URL inválida ou ausente');
if(!process.env.ELECTION_TRUST_ANCHORS_JSON)problems.push('Âncoras das eleições não configuradas');
else{
 try{
  const map=JSON.parse(process.env.ELECTION_TRUST_ANCHORS_JSON);
  if(!map||typeof map!=='object'||Array.isArray(map)||!Object.keys(map).length)throw Error('Nenhuma eleição autorizada');
  for(const id of Object.keys(map))if(!readTrustAnchor(id))throw Error('Âncora não encontrada');
 }catch{problems.push('Mapa de âncoras inválido ou vazio');}
}
if(problems.length){console.error('NÃO PRONTO PARA PRODUÇÃO:\n- '+problems.join('\n- '));process.exitCode=1;}
else console.log('Variáveis obrigatórias presentes e no formato esperado. ISTO NÃO É CERTIFICAÇÃO DE SEGURANÇA.');
