import {timingSafeEqual,createHash} from 'node:crypto';

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const codeFormat=/^[a-f0-9]{64}$/i;
export const setupTokenFormat=/^[a-f0-9]{64}$/i;
export function registrationFields(body){
 const organization=typeof body?.organization==='string'?body.organization.trim():'';
 const email=typeof body?.email==='string'?body.email.trim().toLowerCase():'';
 const password=body?.password;
 const invitation=typeof body?.invitation==='string'?body.invitation.trim():'';
 if(organization.length<2||organization.length>120)throw Error('Informe uma organização de 2 a 120 caracteres.');
 if(email.length>254||!EMAIL.test(email))throw Error('E-mail inválido.');
 if(typeof password!=='string'||password.length<16||password.length>1024)throw Error('A senha deve conter de 16 a 1024 caracteres.');
 if(!codeFormat.test(invitation))throw Error('Informe o código de convite válido.');
 return {organization,email,password,invitation:invitation.toLowerCase()};
}
export function secretDigest(value){return createHash('sha256').update(value).digest('hex');}
export function isValidSetupToken(value){return typeof value==='string'&&setupTokenFormat.test(value);}
export function validTotpCode(code){return typeof code==='string'&&/^\d{6}$/.test(code);}
export function safeCompareCode(a,b){
 if(!codeFormat.test(a||'')||!codeFormat.test(b||''))return false;
 return timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
}
