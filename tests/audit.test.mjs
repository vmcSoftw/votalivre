import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes} from 'node:crypto';
import {assembleManifest,ballotCommitment,merkleRoot,signManifest,verifyManifest,verifyAuditBundle} from '../lib/audit.js';
import {encryptChoice,deriveElectionKey,sha256} from '../lib/crypto.js';
process.env.BALLOT_ENCRYPTION_KEY=randomBytes(32).toString('hex');
const eid='a999d740-0101-4ee1-98b8-b73e637da7a7';
const a='ef107a16-fde0-4987-a2d0-43f1631910ee';
const b='52df8c1c-b12e-4fcc-a972-10a78f62d9bc';
const options=[{id:a,label:'Chapa A',kind:'candidate',position:1},{id:b,label:'Chapa B',kind:'candidate',position:2}];
const election={id:eid,title:'Eleições da escola',organization_name:'Escola Exemplo',starts_at:'2026-01-20T13:00:00Z',ends_at:'2026-01-20T15:00:00Z'};
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const privatePem=privateKey.export({type:'pkcs8',format:'pem'}).toString();
const publicPem=publicKey.export({type:'spki',format:'pem'}).toString();
function create(){
 const encryptedBallots=[a,b,a,a].map(o=>encryptChoice(eid,o));
 const receiptHashes=[1,2,3,4].map(i=>sha256('recibo-secreto-'+i));
 const manifest=assembleManifest({election,options,encryptedBallots,receiptHashes,issued:6,used:4,decrypt:(id,value)=>{
  const {decryptChoice}=REQUIRE_CRYPTO;return decryptChoice(id,value);
 },createdAt:'2026-01-20T15:30:00Z'});
 const signed=signManifest(manifest,privatePem);
 return {manifest,signed,bundle:{schema:'votalivre-commission-bundle-v1',attestation:{manifestText:signed.manifestText,signature:signed.signature,publicKeyPem:signed.publicKeyPem},encryptedBallots,electionKeyHex:deriveElectionKey(eid).toString('hex')}};
}
import * as REQUIRE_CRYPTO from '../lib/crypto.js';
test('Merkle is deterministic and affected by content',()=>{
 const x=sha256('x'),y=sha256('y');
 assert.equal(merkleRoot('ballots',[x,y]),merkleRoot('ballots',[y,x]));
 assert.notEqual(merkleRoot('ballots',[x,y]),merkleRoot('ballots',[x,x]));
 assert.notEqual(merkleRoot('ballots',[x]),merkleRoot('receipts',[x]));
});
test('offline commissioner can independently retally signed bundle',()=>{
 const {manifest,signed,bundle}=create();
 assert.equal(manifest.totals.ballots,4);
 assert.equal(manifest.options[0].votes,3);
 assert.equal(manifest.options[1].votes,1);
 assert.equal(verifyManifest(signed.manifestText,signed.signature,publicPem),true);
 const result=verifyAuditBundle(bundle,publicPem);
 assert.equal(result.ok,true);assert.equal(result.ballots,4);
});
test('signed document rejects tampering and wrong trusted public key',()=>{
 const {bundle,signed}=create();
 const cloned=structuredClone(bundle);cloned.attestation.manifestText+=' ';
 assert.throws(()=>verifyAuditBundle(cloned,publicPem),/assinatura/i);
 assert.equal(verifyManifest(signed.manifestText,signed.signature,generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'pem'}).toString()),false);
});
test('auditor rejects changed ciphertext or wrong election key',()=>{
 const {bundle}=create();
 const cloned=structuredClone(bundle);cloned.encryptedBallots[0]=encryptChoice(eid,b);
 assert.throws(()=>verifyAuditBundle(cloned,publicPem),/Cédulas diferentes/i);
 const wrong=structuredClone(bundle);wrong.electionKeyHex=randomBytes(32).toString('hex');
 assert.throws(()=>verifyAuditBundle(wrong,publicPem));
});
test('fail closed if receipt, used tokens and ballot totals differ',()=>{
 assert.throws(()=>assembleManifest({election,options,encryptedBallots:[encryptChoice(eid,a)],receiptHashes:[],issued:2,used:1,decrypt:()=>a,createdAt:new Date()}),/DIVERGÊNCIA CRÍTICA/);
});
test('receipts and ciphers are not linked by exported manifest',()=>{
 const {manifest}=create();
 assert.ok(!('ciphertext' in manifest.commitments));
 assert.equal(manifest.commitments.ballotHashes.length,4);
 assert.equal(manifest.commitments.receiptHashes.length,4);
 assert.ok(!('receiptHash' in manifest.options[0]));
});
