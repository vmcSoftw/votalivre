import {db} from './db.js';
import {createHmac} from 'node:crypto';
import {sha256} from './crypto.js';
export {sha256,makeToken,makeReceipt,makeVoterPin,tokenDigest,voterPinDigest,passwordHash,verifyPassword,encodeBase32,decodeBase32,totp,verifyTotp,encryptChoice,decryptChoice,deriveElectionKey,encryptMfaSecret,decryptMfaSecret} from './crypto.js';
export async function adminContext(session){
 if(!session||!/^[a-f0-9]{64}$/.test(session))return null;
 const sql=db();const [user]=await sql`
   UPDATE admin_sessions s SET last_seen=NOW()
   FROM admin_users u
   WHERE s.session_hash=${sha256(session)} AND s.user_id=u.id AND u.active=TRUE
     AND s.expires_at>NOW() AND s.last_seen > NOW() - INTERVAL '20 minutes'
   RETURNING u.id, u.organization_id, u.email, u.role`;
 return user||null;
}
export const authenticated=async session=>Boolean(await adminContext(session));
export function originAllowed(req){
 // Prévia Vercel: o domínio do deploy é fornecido pela plataforma (não pelo cliente).
 // Em produção com domínio próprio, configure APP_ORIGIN explicitamente.
 const target=process.env.APP_ORIGIN || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
 if(!target)throw Error('APP_ORIGIN/VERCEL_URL não configurada');
 const expected=new URL(target).origin;
 return req.headers.get('origin')===expected;
}
export class PublicError extends Error{constructor(message,status=400){super(message);this.status=status;}}
export function postGuard(req){
 if(!originAllowed(req))throw new PublicError('Origem não autorizada',403);
 const length=Number(req.headers.get('content-length')||0);
 if(!Number.isFinite(length)||length>12000)throw new PublicError('Requisição excede limite de tamanho',413);
 const type=req.headers.get('content-type')?.split(';')[0].trim();
 if(type!=='application/json')throw new PublicError('Use application/json',415);
}
export async function limitedJSON(req){
 const raw=await req.text();if(Buffer.byteLength(raw)>12000)throw new PublicError('Requisição muito grande',413);
 try{return JSON.parse(raw);}catch{throw new PublicError('JSON inválido',400);}
}
export function asError(err){
 if(err instanceof PublicError)return Response.json({error:err.message},{status:err.status,headers:{'Cache-Control':'no-store'}});
 // Nunca retornar detalhe do banco, segredo ou rastreio interno ao cliente.
 console.error('[API] Falha interna:',err?.name||'Error');
 return Response.json({error:'Não foi possível concluir a operação.'},{status:500,headers:{'Cache-Control':'no-store'}});
}
