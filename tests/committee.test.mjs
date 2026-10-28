import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes} from 'node:crypto';
import {assembleManifest,signManifest} from '../lib/audit.js';
import {encryptChoice,deriveElectionKey,sha256,decryptChoice} from '../lib/crypto.js';
import {createCommitteeRoster,committeeRosterFingerprint,createCommitteeApproval,createCommitteeCertificate,verifyCommitteeCertificate} from '../lib/committee.js';
process.env.BALLOT_ENCRYPTION_KEY=randomBytes(32).toString('hex');
const electionId='77f7af1d-3c29-4815-a6a1-b66439433401';
const option1='b5fd186c-fcb3-4bd9-8e89-b54f376db06b';
const option2='cce5f91c-45e2-45d6-8009-f7057d4ec95b';
function keys(){const {privateKey,publicKey}=generateKeyPairSync('ed25519');return {privatePem:privateKey.export({format:'pem',type:'pkcs8'}).toString(),publicPem:publicKey.export({format:'pem',type:'spki'}).toString()};}
const seal=keys(),members=[keys(),keys(),keys()];
const roster=createCommitteeRoster(electionId,2,members.map((m,i)=>({id:`fiscal${i+1}`,name:`Fiscal ${i+1}`,publicKeyPem:m.publicPem})));
function fixture(){
 const encryptedBallots=[option1,option2,option1].map(x=>encryptChoice(electionId,x));
 const manifest=assembleManifest({election:{id:electionId,title:'Eleição experimental',organization_name:'Escola exemplo',starts_at:'2026-10-01T12:00:00Z',ends_at:'2026-10-01T14:00:00Z'},options:[{id:option1,label:'Chapa 1',kind:'candidate',position:1},{id:option2,label:'Chapa 2',kind:'candidate',position:2}],encryptedBallots,receiptHashes:[1,2,3].map(x=>sha256(`recibo-${x}`)),issued:5,used:3,decrypt:decryptChoice,createdAt:'2026-10-01T14:30:00Z'});
 const signed=signManifest(manifest,seal.privatePem);
 return {attestation:{manifestText:signed.manifestText,signature:signed.signature,publicKeyPem:signed.publicKeyPem},encryptedBallots,electionKeyHex:deriveElectionKey(electionId).toString('hex')};
}
function signedFixture(){const f=fixture();return {schema:'votalivre-commission-bundle-v1',...f,attestation:f.attestation};}
function approval(bundle,i){return createCommitteeApproval({bundle,trustedSealKeyPem:seal.publicPem,roster,auditorId:`fiscal${i+1}`,privateKeyPem:members[i].privatePem});}
function cert(bundle,list){return createCommitteeCertificate(bundle.attestation,roster,list);}
function check(c,trustedRoster=roster){return verifyCommitteeCertificate({certificate:c,trustedSealKeyPem:seal.publicPem,trustedRoster});}
test('Quórum 2/3 de auditores independentes aprovados após recontagem',()=>{
 const b=signedFixture();const result=check(cert(b,[approval(b,0),approval(b,1)]));
 assert.deepEqual(result.approved,['fiscal1','fiscal2']);assert.equal(result.ballots,3);assert.equal(result.required,2);
});
test('Um único endosso não atinge quórum',()=>{const b=signedFixture();assert.throws(()=>check(cert(b,[approval(b,0)])),/insuficientes/);});
test('Endosso duplicado não pode ser contado duas vezes',()=>{const b=signedFixture();const a=approval(b,0);assert.throws(()=>check(cert(b,[a,a])),/repetido/);});
test('Lista alterada com chave não confiada é rejeitada',()=>{const b=signedFixture();const c=cert(b,[approval(b,0),approval(b,1)]);const trust=structuredClone(roster);c.roster.members[0].publicKeyPem=keys().publicPem;assert.throws(()=>check(c,trust),/divergente/);});
test('Assinatura adulterada é rejeitada',()=>{const b=signedFixture();const c=cert(b,[approval(b,0),approval(b,1)]);c.approvals[0].signature='A'+c.approvals[0].signature.slice(1);assert.throws(()=>check(c),/Assinatura inválida/);});
test('Endosso de outro manifesto não vale para resultado diferente',()=>{
 const b=signedFixture(),a=approval(b,0);const b2=signedFixture();assert.throws(()=>check(cert(b2,[a,approval(b2,1)])),/não corresponde exatamente/);
});
test('Assinatura de lacração com chave não confiada é rejeitada',()=>{const b=signedFixture(),c=cert(b,[approval(b,0),approval(b,1)]);assert.throws(()=>verifyCommitteeCertificate({certificate:c,trustedSealKeyPem:keys().publicPem,trustedRoster:roster}),/lacração inválida/);});
test('Lista não permite chaves ou ids duplicados',()=>{
 assert.throws(()=>createCommitteeRoster(electionId,2,[{id:'fiscal1',name:'Primeiro fiscal',publicKeyPem:members[0].publicPem},{id:'fiscal2',name:'Segundo fiscal',publicKeyPem:members[0].publicPem}]),/duplicado/);
 assert.throws(()=>createCommitteeRoster(electionId,2,[{id:'fiscal1',name:'Primeiro fiscal',publicKeyPem:members[0].publicPem},{id:'fiscal1',name:'Segundo fiscal',publicKeyPem:members[1].publicPem}]),/duplicado/);
});
test('Quem não consta na comissão não pode aprovar',()=>{const b=signedFixture();assert.throws(()=>createCommitteeApproval({bundle:b,trustedSealKeyPem:seal.publicPem,roster,auditorId:'outsider',privateKeyPem:members[0].privatePem}),/não consta/);});
test('Chave particular diferente do cadastro é rejeitada',()=>{const b=signedFixture();assert.throws(()=>createCommitteeApproval({bundle:b,trustedSealKeyPem:seal.publicPem,roster,auditorId:'fiscal1',privateKeyPem:members[1].privatePem}),/não pertence/);});
test('Pacote de auditoria adulterado impede aprovação',()=>{const b=signedFixture();b.encryptedBallots[0]='adulterada';assert.throws(()=>approval(b,0));});
test('Impressão da comissão é determinística e vinculada à eleição',()=>{assert.match(committeeRosterFingerprint(roster),/^[0-9a-f]{64}$/);const alt=createCommitteeRoster('77f7af1d-3c29-4815-a6a1-b66439433402',2,roster.members);assert.notEqual(committeeRosterFingerprint(roster),committeeRosterFingerprint(alt));});
