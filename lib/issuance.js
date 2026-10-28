import {createCipheriv,createDecipheriv,randomBytes,createHmac} from 'node:crypto';

function issuanceKey(){
 const hex=process.env.ISSUANCE_ENCRYPTION_KEY;
 if(!/^[a-f0-9]{64}$/i.test(hex||'')) throw Error('ISSUANCE_ENCRYPTION_KEY inválida');
 return Buffer.from(hex,'hex');
}
export function encryptPinBatch(batchId,electionId,pins){
 if(!Array.isArray(pins)||pins.length<1||pins.length>300||pins.some(x=>!/^\d{10}$/.test(x)))throw Error('Lote inválido');
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',issuanceKey(),iv);
 cipher.setAAD(Buffer.from(`${batchId}:${electionId}`));
 const body=Buffer.concat([cipher.update(JSON.stringify(pins),'utf8'),cipher.final()]);
 return Buffer.concat([iv,body,cipher.getAuthTag()]).toString('base64url');
}
export function decryptPinBatch(batchId,electionId,blob){
 const packed=Buffer.from(blob,'base64url');
 if(packed.length<29)throw Error('Lote cifrado inválido');
 const decipher=createDecipheriv('aes-256-gcm',issuanceKey(),packed.subarray(0,12));
 decipher.setAAD(Buffer.from(`${batchId}:${electionId}`));
 decipher.setAuthTag(packed.subarray(-16));
 const pins=JSON.parse(Buffer.concat([decipher.update(packed.subarray(12,-16)),decipher.final()]).toString('utf8'));
 if(!Array.isArray(pins)||pins.length<1||pins.length>300||pins.some(x=>!/^\d{10}$/.test(x)))throw Error('Lote cifrado inválido');
 return pins;
}
export function hashSource(value){
 const hex=process.env.LOGIN_RATE_SECRET;
 if(!/^[a-f0-9]{64}$/i.test(hex||''))throw Error('LOGIN_RATE_SECRET inválida');
 return createHmac('sha256',Buffer.from(hex,'hex')).update(`votalivre:source:v1:${value}`).digest('hex');
}
// Não confiar em X-Forwarded-For entregue diretamente por clientes.
// Na hospedagem Vercel, a plataforma sobrescreve esse header na borda.
export function trustedSource(request){
 if(process.env.VERCEL==='1'){
  const ip=request.headers.get('x-forwarded-for');
  if(ip&&ip.length<80&&!ip.includes(',')&&/^[0-9a-fA-F:.]+$/.test(ip))return `vercel-ip:${ip}`;
 }
 // Fora de proxy conhecido, o rate-limit usa balde compartilhado.
 // Em produção fora da Vercel, configurar WAF/proxy antes de liberar uso.
 return 'unidentified-source';
}
