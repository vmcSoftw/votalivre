import {createHash, createHmac, randomBytes, timingSafeEqual, scrypt as scryptCallback, createCipheriv, createDecipheriv, hkdfSync, randomInt} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback);
export const sha256=value=>createHash('sha256').update(value).digest('hex');
export const makeToken=()=>randomBytes(32).toString('base64url');
export const makeReceipt=()=>randomBytes(32).toString('base64url');
// Código entregue por canal distinto da credencial. Não constitui MFA nem comprova identidade.
export const makeVoterPin=()=>String(randomInt(0,10_000_000_000)).padStart(10,'0');
function readHexSecret(name, length=32){
 const secret=process.env[name];
 if(!secret||!new RegExp(`^[0-9a-fA-F]{${length*2}}$`).test(secret))throw Error(`${name} deve conter ${length} bytes em hexadecimal.`);
 return Buffer.from(secret,'hex');
}
export function tokenDigest(value){return createHmac('sha256',readHexSecret('TOKEN_PEPPER')).update(value).digest('hex');}
export function voterPinDigest(electionId,token,pin){
 if(!/^[0-9]{10}$/.test(pin))throw Error('Formato de código inválido');
 return createHmac('sha256',readHexSecret('VOTER_PIN_PEPPER')).update(`${electionId}\0${token}\0${pin}`).digest('hex');
}
export async function passwordHash(password){
 if(typeof password!=='string'||password.length<16||password.length>1024)throw Error('Senha inválida: use de 16 a 1024 caracteres');
 const salt=randomBytes(16),key=await scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
 return `scrypt$32768$${salt.toString('hex')}$${key.toString('hex')}`;
}
export async function verifyPassword(password,stored){
 if(typeof password!=='string'||password.length>1024||!/^scrypt\$32768\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(stored||''))return false;
 const [, ,salt,digest]=stored.split('$');const actual=await scrypt(password,Buffer.from(salt,'hex'),64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
 return timingSafeEqual(actual,Buffer.from(digest,'hex'));
}
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function encodeBase32(buffer){let bits=0,val=0,output='';for(const byte of buffer){val=(val<<8)|byte;bits+=8;while(bits>=5){output+=alphabet[(val>>>(bits-5))&31];bits-=5;}}if(bits)output+=alphabet[(val<<(5-bits))&31];return output;}
export function decodeBase32(input){let bits=0,val=0,bytes=[];for(const char of input.toUpperCase().replace(/=|\s/g,'')){const idx=alphabet.indexOf(char);if(idx<0)throw Error('Segredo TOTP inválido');val=(val<<5)|idx;bits+=5;if(bits>=8){bytes.push((val>>>(bits-8))&255);bits-=8;}}return Buffer.from(bytes);}
export function totp(secret,time=Date.now()){
 const step=Math.floor(time/30000),msg=Buffer.alloc(8);msg.writeBigUInt64BE(BigInt(step));
 const mac=createHmac('sha1',decodeBase32(secret)).update(msg).digest();const pos=mac.at(-1)&15;
 const code=(mac.readUInt32BE(pos)&0x7fffffff)%1000000;return String(code).padStart(6,'0');
}
export function verifyTotp(secret,provided,now=Date.now()){
 if(!/^\d{6}$/.test(provided||''))return false;
 // Pequena tolerância de relógio; replay impedido por last_totp_step no banco.
 for(const offset of [-1,0,1]){
   const time=now+offset*30000;const expected=totp(secret,time);
   if(timingSafeEqual(Buffer.from(expected),Buffer.from(provided)))return Math.floor(time/30000);
 }
 return false;
}
export function deriveElectionKey(electionId){
 if(!/^[0-9a-f-]{36}$/i.test(electionId))throw Error('ID de eleição inválido');
 return Buffer.from(hkdfSync('sha256',readHexSecret('BALLOT_ENCRYPTION_KEY'), Buffer.from(electionId,'utf8'), Buffer.from('VotaLivre/v3/ballots/AES-256-GCM'),32));
}
export function encryptChoice(electionId,optionId){
 const nonce=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',deriveElectionKey(electionId),nonce);
 cipher.setAAD(Buffer.from(electionId,'utf8'));
 const ciphertext=Buffer.concat([cipher.update(optionId,'utf8'),cipher.final()]);
 return Buffer.concat([nonce,cipher.getAuthTag(),ciphertext]).toString('base64url');
}
export function decryptChoice(electionId,payload){
 const value=Buffer.from(payload,'base64url');if(value.length<29)throw Error('Voto cifrado malformado');
 const decipher=createDecipheriv('aes-256-gcm',deriveElectionKey(electionId),value.subarray(0,12));
 decipher.setAAD(Buffer.from(electionId,'utf8'));decipher.setAuthTag(value.subarray(12,28));
 return Buffer.concat([decipher.update(value.subarray(28)),decipher.final()]).toString('utf8');
}

export function encryptMfaSecret(secret){
 const nonce=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',readHexSecret('MFA_ENCRYPTION_KEY'),nonce);
 cipher.setAAD(Buffer.from('votalivre:totp'));
 const ciphertext=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);
 return Buffer.concat([nonce,cipher.getAuthTag(),ciphertext]).toString('base64url');
}
export function decryptMfaSecret(payload){
 const bytes=Buffer.from(payload,'base64url');if(bytes.length<29)throw Error('Credencial MFA inválida');
 const decipher=createDecipheriv('aes-256-gcm',readHexSecret('MFA_ENCRYPTION_KEY'),bytes.subarray(0,12));
 decipher.setAAD(Buffer.from('votalivre:totp'));decipher.setAuthTag(bytes.subarray(12,28));
 return Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8');
}

export function decryptChoiceWithElectionKey(electionId,payload,keyHex){
 if(!/^[a-f0-9]{64}$/i.test(keyHex))throw Error('Chave da eleição inválida');
 const value=Buffer.from(payload,'base64url');if(value.length<29)throw Error('Voto cifrado malformado');
 const decipher=createDecipheriv('aes-256-gcm',Buffer.from(keyHex,'hex'),value.subarray(0,12));
 decipher.setAAD(Buffer.from(electionId,'utf8'));decipher.setAuthTag(value.subarray(12,28));
 return Buffer.concat([decipher.update(value.subarray(28)),decipher.final()]).toString('utf8');
}
