/** Executar com a comissão; produz APENAS impressões digitais públicas. */
import {readFileSync} from 'node:fs';
import {sealKeyFingerprint} from '../lib/trust-anchors.js';
import {committeeRosterFingerprint} from '../lib/committee.js';
const [rosterFile,sealFile]=process.argv.slice(2);
if(!rosterFile||!sealFile)throw Error('Uso: npm run trust:pin -- <lista-comissao.json> <chave-lacracao-publica.pem>');
const roster=JSON.parse(readFileSync(rosterFile,'utf8'));
const result={sealKeyFingerprint:sealKeyFingerprint(readFileSync(sealFile,'utf8')),rosterFingerprint:committeeRosterFingerprint(roster)};
console.log(JSON.stringify({[roster.electionId]:result},null,2));
console.error('ATENÇÃO: assinar e distribuir estas impressões por canal independente ANTES do início. A aplicação não comprova essa etapa.');
