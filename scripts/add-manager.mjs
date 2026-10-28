// Usage: npm run admin:add -- "ID_ORGANIZACAO" "gestor2@exemplo.org"
// Só executa com acesso ao banco autorizado e terminal interativo.
import {randomBytes} from 'node:crypto';
import {passwordHash,encodeBase32,encryptMfaSecret} from '../lib/crypto.js';
import {db} from '../lib/db.js';
import {readSecret} from './read-secret.mjs';
const [organizationId,emailArgument]=process.argv.slice(2);
const email=(emailArgument||'').trim().toLowerCase();
if(!/^[a-f0-9-]{36}$/i.test(organizationId||'')||!/^\S+@\S+\.\S+$/.test(email)||!process.env.DATABASE_URL){
 console.error('Uso: npm run admin:add -- "UUID_DA_ORGANIZACAO" "email@dominio"');process.exit(1);
}
const sql=db();
try {
 const [org]=await sql`SELECT id FROM organizations WHERE id=${organizationId}`;
 if(!org)throw Error('Organização não encontrada');
 const password=await readSecret('Senha exclusiva do novo gestor (mínimo 16 caracteres): ');
 if(password.length<16||password.length>1024)throw Error('Senha deve ter 16 a 1024 caracteres');
 const totpSecret=encodeBase32(randomBytes(20));
 await sql`INSERT INTO admin_users(organization_id,email,password_hash,totp_secret,role)
 VALUES(${organizationId},${email},${await passwordHash(password)},${encryptMfaSecret(totpSecret)},'manager')`;
 console.log('Novo gestor criado. Segredo TOTP para cadastro no autenticador, exibido UMA vez:');
 console.log(totpSecret);
 console.log('URI OTP:',`otpauth://totp/${encodeURIComponent('VotaLivre:'+email)}?secret=${totpSecret}&issuer=VotaLivre`);
 console.log('Não registrar esta saída em logs nem capturas de tela.');
} finally {await sql.end()}
