import {createHmac,randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';

const HEXPATTERN=/^[a-f0-9]{64}$/i;
function key(){
 const k=process.env.ROSTER_PROTECTION_KEY;
 if(!HEXPATTERN.test(k||''))throw Error('ROSTER_PROTECTION_KEY ausente ou inválida');
 return Buffer.from(k,'hex');
}
export function normalizeIdentifier(id){
 if(typeof id!=='string')throw Error('Identificador deve ser texto');
 const value=id.normalize('NFKC').trim().toUpperCase();
 if(!/^[\p{L}\p{N}._\-\/]{2,40}$/u.test(value))throw Error('Identificador inválido: use 2–40 letras, números, ponto, hífen, barra ou sublinhado');
 return value;
}
export function validateVoters(entries){
 if(!Array.isArray(entries)||entries.length<1||entries.length>250)throw Error('Informe entre 1 e 250 eleitores por lote');
 const seen=new Set();
 return entries.map((entry)=>{
  const identifier=normalizeIdentifier(entry?.identifier);
  const name=typeof entry?.name==='string'?entry.name.normalize('NFC').trim().replace(/\s+/g,' '):'';
  if(name.length<2||name.length>120||/[\p{Cc}\p{Cf}]/u.test(name))throw Error(`Nome inválido para identificador ${identifier}`);
  if(seen.has(identifier))throw Error(`Identificador duplicado no lote: ${identifier}`);
  seen.add(identifier);
  return {identifier,name};
 });
}
export function voterDigest(electionId,identifier){
 return createHmac('sha256',key()).update(`votalivre:roster:v1:${electionId}:${normalizeIdentifier(identifier)}`).digest('hex');
}
export function encryptVoterName(electionId,name){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);
 cipher.setAAD(Buffer.from(`votalivre:roster-name:v1:${electionId}`));
 return Buffer.concat([iv,cipher.update(name,'utf8'),cipher.final(),cipher.getAuthTag()]).toString('base64url');
}
export function decryptVoterName(electionId,encrypted){
 const data=Buffer.from(encrypted,'base64url');
 if(data.length<29)throw Error('Registro de nome inválido');
 const decipher=createDecipheriv('aes-256-gcm',key(),data.subarray(0,12));
 decipher.setAAD(Buffer.from(`votalivre:roster-name:v1:${electionId}`));
 decipher.setAuthTag(data.subarray(-16));
 return Buffer.concat([decipher.update(data.subarray(12,-16)),decipher.final()]).toString('utf8');
}
export function quorumStatus({eligible,turnout,minimumPercent}){
 if(!Number.isSafeInteger(eligible)||eligible<0||!Number.isSafeInteger(turnout)||turnout<0||!Number.isInteger(minimumPercent)||minimumPercent<0||minimumPercent>100)throw Error('Dados inválidos para quórum');
 const required=Math.ceil(eligible*minimumPercent/100);
 return {eligible,turnout,minimumPercent,required,achieved:eligible>0&&turnout<=eligible&&turnout>=required,excess:Math.max(0,turnout-eligible),configured:eligible>0};
}
export function tieStatus(options){
 const ranked=options.filter(o=>o.kind==='candidate').sort((a,b)=>b.votes-a.votes);
 if(!ranked.length)return {tie:false,leaders:[]};
 return {tie:ranked.length>1&&ranked[0].votes>0&&ranked[0].votes===ranked[1].votes,leaders:ranked.filter(x=>x.votes===ranked[0].votes).map(x=>x.label)};
}
// CSV separado por ponto e vírgula; protege planilhas contra injeção de fórmulas.
export function safeCsvCell(value){
 const str=String(value??'');
 const safe=/^[\s\u0000-\u001f]*[=+@\-]/.test(str)?`'${str}`:str;
 return `"${safe.replaceAll('"','""')}"`;
}
export function resultCsv({title,organization,options,totals,governance}){
 const rows=[['Relatório VotaLivre Secure 0.7',''],['Instituição',organization],['Eleição',title],['Situação','Apuração lacrada'],['Categoria','Opção','Votos']];
 for(const o of options)rows.push([o.kind,o.label,o.votes]);
 rows.push(['TOTAL','Votos computados',totals.ballots],['TOTAL','Credenciais utilizadas',totals.used]);
 if(governance)rows.push(['QUÓRUM','Eleitores aptos',governance.eligible],['QUÓRUM','Mínimo exigido',governance.required],['QUÓRUM','Alcançado',governance.achieved?'Sim':'Não']);
 return '\uFEFF'+rows.map(row=>row.map(safeCsvCell).join(';')).join('\r\n')+'\r\n';
}
