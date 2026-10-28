import {randomBytes,createHmac, scrypt as callbackScrypt} from 'node:crypto';
import {promisify} from 'node:util';
import {limitAdminLogin} from '@/lib/limits';
import {db} from '@/lib/db';
import {sha256,verifyPassword,verifyTotp,decryptMfaSecret,postGuard,limitedJSON,asError,PublicError} from '@/lib/security';
export const runtime='nodejs';
const scrypt=promisify(callbackScrypt);
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
function loginIdentifier(org,email){
 const key=process.env.LOGIN_RATE_SECRET;
 if(!/^[a-f0-9]{64}$/i.test(key||''))throw Error('Configure LOGIN_RATE_SECRET');
 return createHmac('sha256',Buffer.from(key,'hex')).update(org+':'+email).digest('hex');
}
export async function POST(request){
 try{
  postGuard(request);
  const body=await limitedJSON(request),email=String(body.email||'').trim().toLowerCase(),password=body.password,code=body.code,organizationId=body.organizationId;
  if(!UUID.test(organizationId||'')||email.length>254||!email.includes('@')||typeof password!=='string'||password.length>1024||!/^\d{6}$/.test(code||''))throw new PublicError('Credenciais inválidas',401);
  const sql=db(),identifier=loginIdentifier(organizationId,email);
  await limitAdminLogin(sql,request);
  const [attempt]=await sql`
    INSERT INTO auth_attempts(identifier_hash,window_start,failures) VALUES(${identifier},NOW(),1)
    ON CONFLICT(identifier_hash) DO UPDATE SET
      failures=CASE WHEN auth_attempts.window_start < NOW()-INTERVAL '15 minutes' THEN 1 ELSE auth_attempts.failures+1 END,
      window_start=CASE WHEN auth_attempts.window_start < NOW()-INTERVAL '15 minutes' THEN NOW() ELSE auth_attempts.window_start END
    RETURNING failures`;
  if(attempt.failures>8)throw new PublicError('Muitas tentativas. Aguarde 15 minutos.',429);
  const [user]=await sql`SELECT id,password_hash,totp_secret FROM admin_users WHERE organization_id=${organizationId} AND email=${email} AND active=TRUE`;
  // Dummy scrypt reduz a diferença de tempo entre usuário existente e ausente.
  if(!user)await scrypt('dummy-secret',Buffer.alloc(16),64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
  const passOK=user?await verifyPassword(password,user.password_hash):false;
  const step=user&&passOK?verifyTotp(decryptMfaSecret(user.totp_secret),code):false;
  if(!passOK||step===false)throw new PublicError('Credenciais inválidas',401);
  const session=randomBytes(32).toString('hex');
  const ok=await sql.begin(async tx=>{
   const [changed]=await tx`UPDATE admin_users SET last_totp_step=${step} WHERE id=${user.id} AND last_totp_step < ${step} RETURNING id`;
   if(!changed)return false;
   await tx`INSERT INTO admin_sessions(session_hash,user_id,expires_at) VALUES(${sha256(session)},${user.id},NOW()+INTERVAL '4 hours')`;
   await tx`DELETE FROM auth_attempts WHERE identifier_hash=${identifier}`;
   return true;
  });
  if(!ok)throw new PublicError('Código de autenticação já utilizado ou inválido',401);
  const response=Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
  response.headers.append('Set-Cookie',`admin_session=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=14400${process.env.NODE_ENV==='production'?'; Secure':''}`);
  return response;
 }catch(e){return asError(e)}
}
