// Operador do sistema: código único de cadastro, válido por 24 horas.
// Uso: node --env-file=.env.local scripts/create-registration-invite.mjs
import {randomBytes} from 'node:crypto';
import {db} from '../lib/db.js';
import {secretDigest} from '../lib/registration.js';
if(!process.env.DATABASE_URL){console.error('Configure DATABASE_URL antes.');process.exit(1)}
const code=randomBytes(32).toString('hex');
const sql=db();
try{
 await sql`INSERT INTO organization_registration_invites(code_hash,expires_at)
  VALUES(${secretDigest(code)},NOW()+INTERVAL '24 hours')`;
 console.log('Convite de cadastro válido por 24 horas (somente UMA utilização):');
 console.log(code);
 console.log('Entregue por canal privado ao responsável autorizado; nunca publique este código no Git.');
}finally{await sql.end()}
