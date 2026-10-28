/**
 * Pins de confiança externos ao manifesto e ao certificado disponibilizados
 * pelo servidor da eleição. Exigir duas impressões digitais por eleição.
 * A cópia destas impressões DEVE ser publicada e custodiada fora da aplicação.
 */
import {createHash,createPublicKey} from 'node:crypto';
import {committeeRosterFingerprint} from './committee.js';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX=/^[a-f0-9]{64}$/;
export function sealKeyFingerprint(pem){
 const key=createPublicKey(pem);
 if(key.asymmetricKeyType!=='ed25519')throw Error('Chave de lacração não é Ed25519');
 return createHash('sha256').update(key.export({format:'der',type:'spki'})).digest('hex');
}
export function validateTrustAnchor(anchor){
 if(!anchor || typeof anchor!=='object'||Array.isArray(anchor) ||
    !HEX.test(anchor.sealKeyFingerprint||'')||!HEX.test(anchor.rosterFingerprint||''))
   throw Error('Âncora externa inválida');
 return {sealKeyFingerprint:anchor.sealKeyFingerprint,rosterFingerprint:anchor.rosterFingerprint};
}
export function readTrustAnchor(electionId,source=process.env.ELECTION_TRUST_ANCHORS_JSON){
 if(!UUID.test(electionId||''))throw Error('Eleição inválida');
 if(!source)return null;
 let map;
 try{map=JSON.parse(source);}catch{throw Error('ELECTION_TRUST_ANCHORS_JSON inválido');}
 if(!map||typeof map!=='object'||Array.isArray(map))throw Error('Âncoras precisam de mapa por ID');
 if(!Object.hasOwn(map,electionId))return null;
 return validateTrustAnchor(map[electionId]);
}
export function assertTrustAnchors({sealPublicKeyPem,roster,anchor}){
 const expected=validateTrustAnchor(anchor);
 if(sealKeyFingerprint(sealPublicKeyPem)!==expected.sealKeyFingerprint)
   throw Error('Chave de lacração difere da âncora previamente registrada');
 if(committeeRosterFingerprint(roster)!==expected.rosterFingerprint)
   throw Error('Comissão difere da âncora previamente registrada');
 return true;
}
