import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,generateKeyPairSync} from 'node:crypto';
import {verifyPublication} from '../lib/publication-verifier.js';
import {sealKeyFingerprint} from '../lib/trust-anchors.js';
import {assembleManifest,signManifest} from '../lib/audit.js';
import {encryptChoice,decryptChoice,deriveElectionKey,sha256} from '../lib/crypto.js';
import {createCommitteeRoster,committeeRosterFingerprint,createCommitteeApproval,createCommitteeCertificate} from '../lib/committee.js';
process.env.BALLOT_ENCRYPTION_KEY ||=randomBytes(32).toString('hex');
function pair(){const {publicKey,privateKey}=generateKeyPairSync('ed25519');return {pub:publicKey.export({type:'spki',format:'pem'}).toString(),priv:privateKey.export({type:'pkcs8',format:'pem'}).toString()}}
const eid='abf69bf7-2483-4a47-b4fa-f456dacb1a91',oid='6df33b8d-6cec-4a20-ac78-7a96db48d740';
const election={id:eid,title:'Teste',organization_name:'Fictícia',starts_at:'2026-01-01T12:00:00Z',ends_at:'2026-01-01T13:00:00Z'};
const seal=pair(),auditors=[pair(),pair()];
const roster=createCommitteeRoster(eid,2,auditors.map((p,i)=>({id:`fiscal_${i}`,name:`Fiscal ${i}`,publicKeyPem:p.pub})));
function fixture(){
 const votes=[encryptChoice(eid,oid)];
 const m=assembleManifest({election,options:[{id:oid,label:'Chapa Fictícia',kind:'candidate',position:1},{id:'f840aa90-7d26-4d5e-bd92-f720fb7e5ab1',label:'Branco',kind:'blank',position:2}],encryptedBallots:votes,receiptHashes:[sha256('rec-ficticio')],issued:1,used:1,decrypt:decryptChoice,createdAt:'2026-01-01T13:05:00Z'});
 const att=signManifest(m,seal.priv);
 const bundle={schema:'votalivre-commission-bundle-v1',attestation:{manifestText:att.manifestText,signature:att.signature,publicKeyPem:att.publicKeyPem},encryptedBallots:votes,electionKeyHex:deriveElectionKey(eid).toString('hex')};
 const approvals=auditors.map((a,i)=>createCommitteeApproval({bundle,trustedSealKeyPem:seal.pub,roster,auditorId:`fiscal_${i}`,privateKeyPem:a.priv}));
 return {manifestText:att.manifestText,signature:att.signature,publicKeyPem:att.publicKeyPem,certificate:createCommitteeCertificate(bundle.attestation,roster,approvals),anchor:{sealKeyFingerprint:sealKeyFingerprint(seal.pub),rosterFingerprint:committeeRosterFingerprint(roster)}};
}
test('Auditoria offline confirma manifesto e dois fiscais independentes',()=>{const f=fixture(),r=verifyPublication(f);assert.equal(r.verified,true);assert.equal(r.ballots,1);assert.equal(r.approvals,2)});
test('Rejeita certificado cujo texto não corresponde ao manifesto',()=>{const f=fixture();f.certificate.attestation.manifestText+=' ';assert.throws(()=>verifyPublication(f),/não correspondem/)});
test('Rejeita impressão de chave trocada',()=>{const f=fixture();f.anchor.sealKeyFingerprint='0'.repeat(64);assert.throws(()=>verifyPublication(f),/lacração difere/)});
test('Rejeita impressões de fiscais trocados',()=>{const f=fixture();f.anchor.rosterFingerprint='0'.repeat(64);assert.throws(()=>verifyPublication(f),/Comissão difere/)});
