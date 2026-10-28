/** Verificador offline: somente dados públicos e impressões digitais confiadas. */
import {assertTrustAnchors} from './trust-anchors.js';
import {verifyManifest} from './audit.js';
import {verifyCommitteeCertificate} from './committee.js';
export function verifyPublication({manifestText,signature,publicKeyPem,certificate,anchor}){
 if(typeof manifestText!=='string'||typeof signature!=='string'||typeof publicKeyPem!=='string')throw Error('Documento de lacração incompleto');
 const data=typeof certificate==='string'?JSON.parse(certificate):certificate;
 if(!data||typeof data!=='object'||!data.attestation)throw Error('Certificado da comissão ausente');
 assertTrustAnchors({sealPublicKeyPem:publicKeyPem,roster:data.roster,anchor});
 if(!verifyManifest(manifestText,signature,publicKeyPem))throw Error('Assinatura do manifesto inválida');
 if(data.attestation.manifestText!==manifestText||data.attestation.signature!==signature||data.attestation.publicKeyPem!==publicKeyPem)throw Error('Certificado e manifesto não correspondem');
 const check=verifyCommitteeCertificate({certificate:data,trustedSealKeyPem:publicKeyPem,trustedRoster:data.roster});
 return {verified:true,electionId:check.electionId,manifestSha256:check.manifestSha256,rosterFingerprint:check.rosterFingerprint,approvals:check.approved.length,required:check.required,ballots:check.ballots,limitations:'Verifica documentos e assinaturas, não comprova ausência de coação, integridade dos celulares ou fatos anteriores à lacração.'};
}
