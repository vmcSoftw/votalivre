/** Exemplo: npm run audit:publication -- auditoria.json comissao.json ancoras.json */
import {readFileSync} from 'node:fs';
import {verifyPublication} from '../lib/publication-verifier.js';
const [manifestPath,committeePath,anchorsPath]=process.argv.slice(2);
if(!manifestPath||!committeePath||!anchorsPath)throw Error('Uso: npm run audit:publication -- auditoria.json comissao.json ancoras.json');
const audit=JSON.parse(readFileSync(manifestPath,'utf8'));
const comm=JSON.parse(readFileSync(committeePath,'utf8'));
const anchors=JSON.parse(readFileSync(anchorsPath,'utf8'));
const electionId=JSON.parse(audit.manifestText).election.id;
const anchor=anchors[electionId];
const result=verifyPublication({...audit,certificate:comm.certificate,anchor});
console.log(JSON.stringify(result,null,2));
