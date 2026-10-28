import { createHash, sign, verify, createPublicKey, createPrivateKey } from 'node:crypto';
import { decryptChoiceWithElectionKey } from './crypto.js';
import {quorumStatus,tieStatus} from './institution.js';

const HASH=/^[0-9a-f]{64}$/;
const hash=s=>createHash('sha256').update(s).digest('hex');
const normalizeDate=v=>new Date(v).toISOString();
export function ballotCommitment(electionId,encryptedChoice){
  return hash(`VOTALIVRE:ballot:1:${electionId}:${encryptedChoice}`);
}
export function merkleRoot(kind,values){
  if(!['ballots','receipts'].includes(kind))throw Error('Tipo de compromisso inválido');
  if(!Array.isArray(values)||values.some(v=>typeof v!=='string'||!HASH.test(v)))throw Error('Hash de compromisso inválido');
  const sorted=[...values].sort();
  if(sorted.length===0)return hash(`VOTALIVRE:empty:1:${kind}`);
  let level=sorted.map(v=>hash(`VOTALIVRE:leaf:1:${kind}:${v}`));
  while(level.length>1){
    const next=[];
    for(let i=0;i<level.length;i+=2){next.push(hash(`VOTALIVRE:node:1:${kind}:${level[i]}:${level[i+1]||level[i]}`));}
    level=next;
  }
  return level[0];
}
export function assembleManifest({election,options,encryptedBallots,receiptHashes,issued,used,decrypt,createdAt,governance}){
  if(typeof decrypt!=='function')throw Error('Sem rotina de decifragem');
  const id=election.id;
  if(!Array.isArray(options)||options.length<2)throw Error('Cédula inválida');
  if(!Number.isSafeInteger(issued)||!Number.isSafeInteger(used)||issued<0||used<0||used>issued)throw Error('Credenciais inconsistentes');
  if(encryptedBallots.length!==used||receiptHashes.length!==used)throw Error('DIVERGÊNCIA CRÍTICA: votos, recibos e credenciais utilizadas não coincidem');
  if(new Set(receiptHashes).size!==receiptHashes.length||receiptHashes.some(h=>!HASH.test(h)))throw Error('Recibos inválidos ou duplicados');
  const counts=new Map(options.map(o=>[o.id,0]));
  if(counts.size!==options.length)throw Error('Opções repetidas');
  for(const item of encryptedBallots){
    const choice=decrypt(id,item);
    if(!counts.has(choice))throw Error('DIVERGÊNCIA CRÍTICA: opção desconhecida em voto cifrado');
    counts.set(choice,counts.get(choice)+1);
  }
  const ballotHashes=encryptedBallots.map(v=>ballotCommitment(id,v)).sort();
  if(new Set(ballotHashes).size!==ballotHashes.length)throw Error('Cédulas cifradas duplicadas');
  const receiptList=[...receiptHashes].sort();
  const computedGovernance=governance?{
    ...quorumStatus({eligible:governance.eligible,turnout:encryptedBallots.length,minimumPercent:governance.minimumPercent}),
    tieRule:governance.tieRule,
    ...tieStatus(options.map(o=>({...o,votes:counts.get(o.id)})))
  }:undefined;
  return {
    schema:'votalivre-audit-manifest-v1',
    election:{id,title:election.title,organization:election.organization_name,startsAt:normalizeDate(election.starts_at),endsAt:normalizeDate(election.ends_at)},
    sealedAt:normalizeDate(createdAt),
    options:[...options].sort((a,b)=>a.position-b.position).map(o=>({id:o.id,label:o.label,kind:o.kind,position:o.position,votes:counts.get(o.id)})),
    totals:{issued,used,ballots:encryptedBallots.length,receipts:receiptHashes.length},
    ...(computedGovernance?{governance:computedGovernance}:{}),
    commitments:{ballotsRoot:merkleRoot('ballots',ballotHashes),receiptsRoot:merkleRoot('receipts',receiptList),ballotHashes,receiptHashes:receiptList}
  };
}
export function signManifest(manifest,privateKeyPem){
  const manifestText=JSON.stringify(manifest);
  const privateKey=createPrivateKey(privateKeyPem);
  if(privateKey.asymmetricKeyType!=='ed25519')throw Error('Exige chave Ed25519');
  return {
    manifestText,
    signature:sign(null,Buffer.from(manifestText,'utf8'),privateKey).toString('base64url'),
    publicKeyPem:createPublicKey(privateKey).export({format:'pem',type:'spki'}).toString()
  };
}
export function verifyManifest(manifestText,signature,publicKeyPem){
  try{
    const publicKey=createPublicKey(publicKeyPem);
    if(publicKey.asymmetricKeyType!=='ed25519')return false;
    return verify(null,Buffer.from(manifestText,'utf8'),publicKey,Buffer.from(signature,'base64url'));
  }catch{return false;}
}
export function verifyAuditBundle(bundle,trustedPublicKeyPem){
  if(bundle?.schema!=='votalivre-commission-bundle-v1')throw Error('Pacote de auditoria inválido');
  const {attestation,encryptedBallots,electionKeyHex}=bundle;
  const exactTrust=createPublicKey(trustedPublicKeyPem).export({format:'der',type:'spki'}).toString('hex');
  const declaredKey=createPublicKey(attestation.publicKeyPem).export({format:'der',type:'spki'}).toString('hex');
  if(exactTrust!==declaredKey)throw Error('Chave de assinatura diferente da chave previamente confiada à comissão');
  if(!verifyManifest(attestation.manifestText,attestation.signature, trustedPublicKeyPem))throw Error('Assinatura inválida: manifesto possivelmente adulterado');
  const manifest=JSON.parse(attestation.manifestText);
  if(manifest.schema!=='votalivre-audit-manifest-v1')throw Error('Versão de manifesto desconhecida');
  if(!Array.isArray(encryptedBallots)||encryptedBallots.length!==manifest.totals.ballots)throw Error('Número de cédulas divergente');
  if(manifest.totals.used!==manifest.totals.ballots||manifest.totals.receipts!==manifest.totals.ballots||manifest.totals.issued<manifest.totals.used)throw Error('Totais inconsistentes');
  if(manifest.governance){
    const g=manifest.governance;
    const recalculated=quorumStatus({eligible:g.eligible,turnout:manifest.totals.ballots,minimumPercent:g.minimumPercent});
    if(g.turnout!==recalculated.turnout||g.required!==recalculated.required||g.achieved!==recalculated.achieved||g.configured!==recalculated.configured||g.excess!==recalculated.excess)throw Error('Divergência nos indicadores de quórum');
    const expectedTie=tieStatus(manifest.options);
    if(g.tie!==expectedTie.tie||JSON.stringify(g.leaders)!==JSON.stringify(expectedTie.leaders))throw Error('Divergência na regra de empate');
  }
  const values=encryptedBallots.map(s=>ballotCommitment(manifest.election.id,s)).sort();
  if(JSON.stringify(values)!==JSON.stringify(manifest.commitments.ballotHashes))throw Error('Cédulas diferentes do manifesto assinado');
  if(merkleRoot('ballots',values)!==manifest.commitments.ballotsRoot)throw Error('Raiz das cédulas divergente');
  const receiptHashes=manifest.commitments.receiptHashes;
  if(receiptHashes.length!==manifest.totals.receipts||new Set(receiptHashes).size!==receiptHashes.length||merkleRoot('receipts',receiptHashes)!==manifest.commitments.receiptsRoot)throw Error('Compromisso de recibos inconsistente');
  const counts=new Map(manifest.options.map(o=>[o.id,0]));
  if(counts.size!==manifest.options.length)throw Error('Opções duplicadas');
  for(const ballot of encryptedBallots){
    const optionId=decryptChoiceWithElectionKey(manifest.election.id,ballot,electionKeyHex);
    if(!counts.has(optionId))throw Error('Voto inválido após decifragem');
    counts.set(optionId,counts.get(optionId)+1);
  }
  for(const option of manifest.options)if(counts.get(option.id)!==option.votes)throw Error(`Contagem divergente para opção ${option.label}`);
  if([...counts.values()].reduce((a,b)=>a+b,0)!==manifest.totals.ballots)throw Error('Somatório divergente');
  return {ok:true,election:manifest.election,ballots:encryptedBallots.length,results:manifest.options.map(o=>({label:o.label,kind:o.kind,votes:o.votes})),fingerprint:hash(attestation.manifestText)};
}
