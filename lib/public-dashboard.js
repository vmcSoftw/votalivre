/**
 * Projection of public election data. Never read this from the ballots table.
 * No voter identifiers, vote timestamps, credentials, encrypted ballots, or secrets.
 * The application's trust in committee keys MUST be checked externally.
 */
import {createHash} from 'node:crypto';
import {verifyManifest} from './audit.js';
import {verifyCommitteeCertificate} from './committee.js';
import {readTrustAnchor,assertTrustAnchors} from './trust-anchors.js';

const hash = value => createHash('sha256').update(value).digest('hex');
const integer = value => Number.isSafeInteger(value) && value >= 0;
const dateString = date => new Date(date).toISOString();

function publicIdentity(election){
  return {id:election.id,title:election.title,organization:election.organization_name,
    startsAt:dateString(election.starts_at),endsAt:dateString(election.ends_at)};
}
function waiting(election,status,message){
  return {schema:'votalivre-public-dashboard-v1',...publicIdentity(election),status,message,results:null};
}
export function publicDashboard({election,snapshot=null,certificate=null,now=new Date(),trustedAnchor=undefined}){
  const start=new Date(election.starts_at).getTime(),end=new Date(election.ends_at).getTime(),time=new Date(now).getTime();
  if(!Number.isFinite(start)||!Number.isFinite(end)||!Number.isFinite(time)||end<=start)throw Error('Datas da eleição inválidas');
  if(time<start)return waiting(election,'scheduled','Eleição programada. A apuração não está disponível.');
  if(time<end)return waiting(election,'voting','Votação em andamento. Resultados e participação ficam protegidos até a aprovação da comissão.');
  if(!snapshot)return waiting(election,'awaiting_seal','Aguardando lacração digital da apuração.');
  if(!verifyManifest(snapshot.manifest_text,snapshot.signature_base64url,snapshot.public_key_pem))throw Error('Assinatura de lacração inválida');
  if(!certificate)return waiting(election,'awaiting_committee','Aguardando endossos independentes da comissão eleitoral.');

  const cert=typeof certificate.certificate_text==='string' ? JSON.parse(certificate.certificate_text) : certificate;
  if(cert?.attestation?.manifestText!==snapshot.manifest_text ||
     cert?.attestation?.signature!==snapshot.signature_base64url ||
     cert?.attestation?.publicKeyPem!==snapshot.public_key_pem)throw Error('Certificado não corresponde ao manifesto lacrado');
  // Falhar fechado: nenhum resultado público sem chaves pinadas fora do pacote recebido.
  const anchor=trustedAnchor===undefined?readTrustAnchor(election.id):trustedAnchor;
  if(!anchor)return waiting(election,'awaiting_trust','Aguardando a conferência independente das chaves da comissão e de lacração.');
  assertTrustAnchors({sealPublicKeyPem:snapshot.public_key_pem,roster:cert.roster,anchor});
  const check=verifyCommitteeCertificate({certificate:cert,trustedSealKeyPem:snapshot.public_key_pem,trustedRoster:cert.roster});
  const manifest=JSON.parse(snapshot.manifest_text);
  if(manifest?.election?.id!==election.id||check.electionId!==election.id)throw Error('Eleição divergente');
  const {ballots,used,receipts,issued}=manifest.totals||{};
  if(![ballots,used,receipts,issued].every(integer)||ballots!==used||ballots!==receipts||issued<used)throw Error('Totais do manifesto divergentes');
  if(!Array.isArray(manifest.options)||manifest.options.length<2)throw Error('Opções ausentes');
  const choices=new Set();
  let counted=0,valid=0,blank=0,nullVotes=0;
  const options=manifest.options.map(option=>{
    if(typeof option.id!=='string'||choices.has(option.id)||!['candidate','blank','null'].includes(option.kind)||!integer(option.votes)||typeof option.label!=='string')throw Error('Opção inválida');
    choices.add(option.id); counted+=option.votes;
    if(option.kind==='candidate')valid+=option.votes;
    if(option.kind==='blank')blank+=option.votes;
    if(option.kind==='null')nullVotes+=option.votes;
    return {id:option.id,label:option.label,kind:option.kind,votes:option.votes};
  });
  if(counted!==ballots)throw Error('Somatório divergente');
  const g=manifest.governance;
  const eligible=g&&integer(g.eligible)?g.eligible:null;
  const participation=eligible!==null&&eligible>0?Number((100*used/eligible).toFixed(2)):null;
  return {
    schema:'votalivre-public-dashboard-v1',...publicIdentity(election),status:'published',
    publishedAt:certificate.published_at?dateString(certificate.published_at):null,
    sealedAt:manifest.sealedAt||null,
    manifestSha256:hash(snapshot.manifest_text),
    approval:{approved:check.approved.length,required:check.required,totalMembers:cert.roster.members.length,rosterFingerprint:check.rosterFingerprint},
    totals:{issued,used,ballots,valid,blank,nullVotes,eligible,abstentions:eligible===null?null:Math.max(0,eligible-used),participation},
    governance:g?{minimumPercent:g.minimumPercent,configured:!!g.configured,achieved:!!g.achieved,tie:!!g.tie,tieRule:g.tieRule,required:g.required}:null,
    options:options.map(o=>({...o,percentage:o.kind==='candidate'&&valid>0?Number((100*o.votes/valid).toFixed(2)):null})),
    trustAnchors:{sealKeyFingerprint:anchor.sealKeyFingerprint,rosterFingerprint:anchor.rosterFingerprint},
    warning:'Assinaturas verificadas contra impressões digitais previamente configuradas. Confira essas impressões por canal independente. O sistema ainda não oferece verificabilidade ponta a ponta.'
  };
}

/** CSV resistente a injeção de fórmulas; só recebe projeção pública assinada. */
export function publicResultsCsv(dashboard){
  if(dashboard?.status!=='published')throw Error('Apuração não autorizada');
  const safe=(value)=>{
    let text=String(value??'').replace(/\r\n|\r/g,'\n');
    if(/^[\s\u0000-\u001f]*[=+\-@]/.test(text))text="'"+text;
    return '"'+text.replaceAll('"','""')+'"';
  };
  const rows=[
    ['Relatório VotaLivre','APURAÇÃO LACRADA E ENDOSSADA'],
    ['Instituição',dashboard.organization],['Eleição',dashboard.title],
    ['ID',dashboard.id],['Encerramento',dashboard.endsAt],['Lacração',dashboard.sealedAt],
    ['SHA-256 do manifesto',dashboard.manifestSha256],
    ['Endossos válidos',dashboard.approval.approved],['Endossos exigidos',dashboard.approval.required],
    ['Eleitores aptos',dashboard.totals.eligible??'Não informado'],['Credenciais emitidas',dashboard.totals.issued],
    ['Comparecimento',dashboard.totals.used],['Abstenções',dashboard.totals.abstentions??'Não informado'],
    ['Votos válidos',dashboard.totals.valid],['Brancos',dashboard.totals.blank],['Nulos',dashboard.totals.nullVotes],
    [],['CANDIDATO / OPÇÃO','TIPO','VOTOS','PERCENTUAL DOS VÁLIDOS'],
    ...dashboard.options.map(x=>[x.label,x.kind,x.votes,x.percentage===null?'':`${x.percentage.toFixed(2)}%`]),
    [],['AVISO','Verificar as chaves públicas em canal independente; manifesto assinado não prova ausência de coação ou alteração anterior à lacração.']
  ];
  return '\uFEFF'+rows.map(row=>row.map(safe).join(';')).join('\r\n')+'\r\n';
}
