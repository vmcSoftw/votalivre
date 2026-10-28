// Uso: npm run bootstrap -- "Escola Exemplo" "gestor@exemplo.org" ; lê senha do terminal sem eco
import postgres from 'postgres';
import {readSecret} from './read-secret.mjs';
import {randomBytes} from 'node:crypto';
import {passwordHash,encodeBase32,encryptMfaSecret} from '../lib/crypto.js';
const [organization,emailInput]=process.argv.slice(2),email=emailInput?.trim().toLowerCase();
if(!organization||!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!process.env.DATABASE_URL){console.error('Uso: DATABASE_URL=... npm run bootstrap -- "Organização" "email@dominio"');process.exit(1)}
const password=await readSecret('Crie uma senha exclusiva (mínimo 16 caracteres): ');
if(password.length<16){console.error('Senha muito curta');process.exit(1)}
const secret=encodeBase32(randomBytes(20)),sql=postgres(process.env.DATABASE_URL,{ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)?false:'require'});
try{
 const id=await sql.begin(async tx=>{
  const [org]=await tx`INSERT INTO organizations(name) VALUES(${organization}) RETURNING id`;
  await tx`INSERT INTO admin_users(organization_id,email,password_hash,totp_secret,role) VALUES(${org.id},${email},${await passwordHash(password)},${encryptMfaSecret(secret)},'owner')`;
  return org.id;
 });
 console.log(`\nOrganização criada: ${id}`);
 console.log(`TOTP (guardar em gerenciador MFA, mostrado apenas uma vez): ${secret}`);
 console.log(`URI OTP: otpauth://totp/${encodeURIComponent('VotaLivre:'+email)}?secret=${secret}&issuer=VotaLivre&algorithm=SHA1&digits=6&period=30`);
 console.log('Importe a URI/segredo no autenticador e proteja este terminal.');
}finally{await sql.end()}
