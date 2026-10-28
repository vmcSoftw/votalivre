import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,generateKeyPairSync} from 'node:crypto';
import {normalizeIdentifier,validateVoters,voterDigest,encryptVoterName,decryptVoterName,quorumStatus,tieStatus,resultCsv} from '../lib/institution.js';
import {assembleManifest,signManifest,verifyAuditBundle} from '../lib/audit.js';
import {encryptChoice,deriveElectionKey,decryptChoiceWithElectionKey} from '../lib/crypto.js';
const electionId='11111111-1111-4111-8111-111111111111';
process.env.ROSTER_PROTECTION_KEY=randomBytes(32).toString('hex');
process.env.BALLOT_ENCRYPTION_KEY=randomBytes(32).toString('hex');
test('normalização e proteção de dados de aptos',()=>{
 const entries=validateVoters([{identifier:'aluno-001',name:'Ana Maria'},{identifier:'ALUNO-002',name:'Bruno Costa'}]);
 assert.equal(entries[0].identifier,'ALUNO-001');
 assert.notEqual(voterDigest(electionId,'aluno-001'),voterDigest(electionId,'aluno-002'));
 assert.equal(voterDigest(electionId,'aluno-001'),voterDigest(electionId,'ALUNO-001'));
 const ciphertext=encryptVoterName(electionId,entries[0].name);
 assert.ok(!ciphertext.includes('Ana'));
 assert.equal(decryptVoterName(electionId,ciphertext),'Ana Maria');
 assert.throws(()=>decryptVoterName('22222222-2222-4222-8222-222222222222',ciphertext));
});
test('duplicidade e entradas inválidas recusadas',()=>{
 assert.throws(()=>validateVoters([{identifier:'1',name:'Ana'}]));
 assert.throws(()=>validateVoters([{identifier:'abc',name:'Ana'},{identifier:'ABC',name:'Outra pessoa'}]),/duplicado/);
 assert.throws(()=>validateVoters([{identifier:'aluno',name:'\u0000Teste'}]));
 assert.throws(()=>normalizeIdentifier('a b'));
});
test('quórum considera aptos e presença, não apenas votos válidos',()=>{
 assert.deepEqual(quorumStatus({eligible:100,turnout:49,minimumPercent:50}).achieved,false);
 assert.equal(quorumStatus({eligible:100,turnout:50,minimumPercent:50}).required,50);
 assert.equal(quorumStatus({eligible:100,turnout:50,minimumPercent:50}).achieved,true);
 assert.equal(quorumStatus({eligible:3,turnout:1,minimumPercent:34}).required,2);
 assert.equal(quorumStatus({eligible:5,turnout:6,minimumPercent:0}).achieved,false);
 assert.equal(quorumStatus({eligible:0,turnout:0,minimumPercent:0}).configured,false);
});
test('empate e resultado assinado com quórum detectam alteração',()=>{
 const options=[{id:'a',label:'Chapa A',kind:'candidate',position:1},{id:'b',label:'Chapa B',kind:'candidate',position:2},{id:'c',label:'Branco',kind:'blank',position:10000}];
 const key=deriveElectionKey(electionId).toString('hex');
 const encryptedBallots=[encryptChoice(electionId,'a'),encryptChoice(electionId,'b')];
 const manifest=assembleManifest({election:{id:electionId,title:'Grêmio',organization_name:'Escola',starts_at:'2026-10-27T10:00:00Z',ends_at:'2026-10-28T10:00:00Z'},options,encryptedBallots,receiptHashes:[randomBytes(32).toString('hex'),randomBytes(32).toString('hex')],issued:3,used:2,decrypt:(_id,choice)=>decryptChoiceWithElectionKey(electionId,choice,key),createdAt:new Date(),governance:{eligible:4,minimumPercent:50,tieRule:'runoff'}});
 assert.equal(manifest.governance.achieved,true);assert.equal(manifest.governance.tie,true);
 assert.deepEqual(tieStatus(manifest.options).leaders,['Chapa A','Chapa B']);
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');
 const sig=signManifest(manifest,privateKey.export({type:'pkcs8',format:'pem'}));
 const trusted=publicKey.export({type:'spki',format:'pem'});
 const bundle={schema:'votalivre-commission-bundle-v1',attestation:{manifestText:sig.manifestText,signature:sig.signature,publicKeyPem:sig.publicKeyPem},encryptedBallots,electionKeyHex:key};
 assert.equal(verifyAuditBundle(bundle,trusted).ok,true);
 const altered=structuredClone(manifest);altered.governance.required=1;
 const signedChanged=signManifest(altered,privateKey.export({type:'pkcs8',format:'pem'}));
 assert.throws(()=>verifyAuditBundle({...bundle,attestation:{manifestText:signedChanged.manifestText,signature:signedChanged.signature,publicKeyPem:signedChanged.publicKeyPem}},trusted),/quórum/);
});
test('relatório CSV neutraliza fórmulas de planilhas',()=>{
 const csv=resultCsv({title:'=CÁLCULO()',organization:'-SISTEMA',options:[{kind:'candidate',label:'@SUM(A1)',votes:6}],totals:{ballots:6,used:6},governance:quorumStatus({eligible:10,turnout:6,minimumPercent:50})});
 assert.ok(csv.includes("'@SUM(A1)"));
 assert.ok(csv.includes("'=CÁLCULO()"));
 assert.ok(csv.includes("'-SISTEMA"));
 assert.ok(csv.includes('"6"'));
});
