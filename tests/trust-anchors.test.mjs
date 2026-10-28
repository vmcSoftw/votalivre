import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {sealKeyFingerprint,validateTrustAnchor,readTrustAnchor,assertTrustAnchors} from '../lib/trust-anchors.js';
import {createCommitteeRoster,committeeRosterFingerprint} from '../lib/committee.js';
const election='b02d8940-61fe-479f-bf7b-4717f61c8951';
function keys(){const {publicKey}=generateKeyPairSync('ed25519');return publicKey.export({type:'spki',format:'pem'}).toString()}
const seal=keys(),roster=createCommitteeRoster(election,2,[{id:'fiscal_a',name:'Fiscal A',publicKeyPem:keys()},{id:'fiscal_b',name:'Fiscal B',publicKeyPem:keys()}]);
const anchor={sealKeyFingerprint:sealKeyFingerprint(seal),rosterFingerprint:committeeRosterFingerprint(roster)};
test('É possível fixar duas chaves de confiança sem guardar nenhuma chave privada',()=>{assert.equal(validateTrustAnchor(anchor).sealKeyFingerprint.length,64);assert.equal(assertTrustAnchors({sealPublicKeyPem:seal,roster,anchor}),true)});
test('Âncora não configurada não autoriza votação publicada',()=>assert.equal(readTrustAnchor(election,''),null));
test('Carrega o pin exclusivo da eleição e ignora outras',()=>{const raw=JSON.stringify({[election]:anchor});assert.deepEqual(readTrustAnchor(election,raw),anchor);assert.equal(readTrustAnchor('c02d8940-61fe-479f-bf7b-4717f61c8951',raw),null)});
test('Configuração malformada ou inválida falha',()=>{assert.throws(()=>readTrustAnchor(election,'{'),/inválido/);assert.throws(()=>validateTrustAnchor({sealKeyFingerprint:'a'}),/inválida/)});
test('Chave substituída não passa na conferência',()=>assert.throws(()=>assertTrustAnchors({sealPublicKeyPem:keys(),roster,anchor}),/lacração difere/));
test('Lista assinada por comissão diferente não passa',()=>assert.throws(()=>assertTrustAnchors({sealPublicKeyPem:seal,roster:createCommitteeRoster(election,2,[{id:'fiscal_x',name:'Fiscal X',publicKeyPem:keys()},{id:'fiscal_y',name:'Fiscal Y',publicKeyPem:keys()}]),anchor}),/Comissão difere/));
