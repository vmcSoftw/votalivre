/**
 * Comissão fiscalizadora v0.8: endossos digitais independentes de um manifesto.
 * NÃO implementa votação verificável ponta a ponta, criptografia limiar nem
 * comprovação de que um auditor realmente executou os testes declarados.
 * A lista de chaves públicas deve ser fixada por canal externo antes da eleição.
 */
import {createHash,createPublicKey,createPrivateKey,sign,verify} from 'node:crypto';
import {verifyManifest,verifyAuditBundle} from './audit.js';

const HEX=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MEMBER=/^[a-z0-9][a-z0-9_-]{1,31}$/;
const sha256=s=>createHash('sha256').update(s).digest('hex');
function pubKeyPem(pem){
 const key=createPublicKey(pem);
 if(key.asymmetricKeyType!=='ed25519')throw Error('Chave pública não é Ed25519');
 return key.export({format:'pem',type:'spki'}).toString();
}
function keyFingerprint(pem){return sha256(createPublicKey(pubKeyPem(pem)).export({format:'der',type:'spki'}));}
function sameKey(a,b){return keyFingerprint(a)===keyFingerprint(b);}
const requireObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);

export function validateCommitteeRoster(roster){
 if(!requireObject(roster)||roster.schema!=='votalivre-committee-roster-v1'||!UUID.test(roster.electionId||''))throw Error('Lista da comissão ou eleição inválida');
 if(!Array.isArray(roster.members)||roster.members.length<2||roster.members.length>15)throw Error('Comissão exige de 2 a 15 membros');
 if(!Number.isSafeInteger(roster.threshold)||roster.threshold<2||roster.threshold>roster.members.length)throw Error('Quórum de assinaturas inválido');
 const ids=new Set(),keys=new Set();
 for(const m of roster.members){
  if(!requireObject(m)||!MEMBER.test(m.id||'')||typeof m.name!=='string'||m.name.trim().length<2||m.name.length>100)throw Error('Identificação de auditor inválida');
  const f=keyFingerprint(m.publicKeyPem);
  if(ids.has(m.id)||keys.has(f))throw Error('Identificador ou chave da comissão duplicado');
  ids.add(m.id);keys.add(f);
 }
 return true;
}
export function createCommitteeRoster(electionId,threshold,members){
 const roster={schema:'votalivre-committee-roster-v1',electionId,threshold,members:[...members].map(m=>({id:m.id,name:m.name,publicKeyPem:pubKeyPem(m.publicKeyPem)})).sort((a,b)=>a.id.localeCompare(b.id))};
 validateCommitteeRoster(roster);
 return roster;
}
export function committeeRosterFingerprint(roster){
 validateCommitteeRoster(roster);
 const normalized=createCommitteeRoster(roster.electionId,roster.threshold,roster.members);
 return sha256(`VOTALIVRE:committee-roster:v1:\n${JSON.stringify(normalized)}`);
}
function payload(electionId,manifestSha256,rosterFingerprint,auditorId,ballotCount){
 return {schema:'votalivre-committee-approval-v1',electionId,manifestSha256,rosterFingerprint,auditorId,ballotCount,statement:'Auditor declara ter recontado o pacote confidencial com a chave de lacração previamente confiada e obtido resultado consistente. A declaração é de responsabilidade do assinante.'};
}
function signedBytes(p){return Buffer.from(`VOTALIVRE:committee-approval:v1\n${JSON.stringify(p)}`,'utf8');}
export function createCommitteeApproval({bundle,trustedSealKeyPem,roster,auditorId,privateKeyPem}){
 validateCommitteeRoster(roster);
 const member=roster.members.find(x=>x.id===auditorId);
 if(!member)throw Error('Auditor não consta da lista confiada');
 const key=createPrivateKey(privateKeyPem);
 if(key.asymmetricKeyType!=='ed25519'||!sameKey(createPublicKey(key).export({format:'pem',type:'spki'}).toString(),member.publicKeyPem))throw Error('Chave privada não pertence ao membro indicado');
 const check=verifyAuditBundle(bundle,trustedSealKeyPem);
 if(check.election.id!==roster.electionId)throw Error('Pacote pertence a outra eleição');
 const manifestSha256=sha256(bundle.attestation.manifestText);
 const body=payload(check.election.id,manifestSha256,committeeRosterFingerprint(roster),auditorId,check.ballots);
 return {payload:body,signature:sign(null,signedBytes(body),key).toString('base64url')};
}
export function verifyCommitteeCertificate({certificate,trustedSealKeyPem,trustedRoster}){
 validateCommitteeRoster(trustedRoster);
 if(!requireObject(certificate)||certificate.schema!=='votalivre-committee-certificate-v1')throw Error('Certificado de comissão inválido');
 if(committeeRosterFingerprint(certificate.roster)!==committeeRosterFingerprint(trustedRoster))throw Error('Lista de auditores divergente da cópia previamente confiada');
 const att=certificate.attestation;
 if(!requireObject(att)||typeof att.manifestText!=='string'||typeof att.signature!=='string'||typeof att.publicKeyPem!=='string')throw Error('Manifesto ou assinatura ausentes');
 if(!sameKey(att.publicKeyPem,trustedSealKeyPem)||!verifyManifest(att.manifestText,att.signature,trustedSealKeyPem))throw Error('Assinatura da lacração inválida ou não confiada');
 const manifest=JSON.parse(att.manifestText);
 if(manifest.schema!=='votalivre-audit-manifest-v1'||manifest.election.id!==trustedRoster.electionId)throw Error('Manifesto de outra eleição ou versão desconhecida');
 if(!Number.isSafeInteger(manifest.totals.ballots)||manifest.totals.ballots<0)throw Error('Total de cédulas inválido');
 const optionsTotal=manifest.options.reduce((s,o)=>s+o.votes,0);
 if(optionsTotal!==manifest.totals.ballots)throw Error('Somatório do manifesto inconsistente');
 if(!Array.isArray(certificate.approvals)||certificate.approvals.length>trustedRoster.members.length)throw Error('Lista de endossos inválida');
 const seen=new Set(),approved=[];
 for(const approval of certificate.approvals){
  const p=approval?.payload;
  const member=trustedRoster.members.find(x=>x.id===p?.auditorId);
  if(!member||seen.has(p.auditorId)||typeof approval.signature!=='string'||!/^[A-Za-z0-9_-]{80,100}$/.test(approval.signature))throw Error('Endosso desconhecido, repetido ou malformado');
  const expected=payload(trustedRoster.electionId,sha256(att.manifestText),committeeRosterFingerprint(trustedRoster),member.id,manifest.totals.ballots);
  if(JSON.stringify(p)!==JSON.stringify(expected))throw Error('Endosso não corresponde exatamente ao manifesto e à comissão');
  if(!verify(null,signedBytes(p),createPublicKey(member.publicKeyPem),Buffer.from(approval.signature,'base64url')))throw Error(`Assinatura inválida do auditor ${member.id}`);
  seen.add(member.id);approved.push(member.id);
 }
 if(approved.length<trustedRoster.threshold)throw Error(`Aprovações insuficientes: ${approved.length}/${trustedRoster.threshold}`);
 return {ok:true,electionId:trustedRoster.electionId,manifestSha256:sha256(att.manifestText),rosterFingerprint:committeeRosterFingerprint(trustedRoster),approved,required:trustedRoster.threshold,ballots:manifest.totals.ballots,kind:'endossos de conferência, não certificação de segurança do sistema'};
}
export function createCommitteeCertificate(attestation,roster,approvals){
 validateCommitteeRoster(roster);
 return {schema:'votalivre-committee-certificate-v1',roster:structuredClone(roster),attestation:structuredClone(attestation),approvals:structuredClone(approvals)};
}
