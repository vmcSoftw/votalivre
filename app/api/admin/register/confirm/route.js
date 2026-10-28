import {db} from '@/lib/db';
import {postGuard,limitedJSON,asError,PublicError,verifyTotp,decryptMfaSecret} from '@/lib/security';
import {limitAdminRegistration} from '@/lib/limits';
import {secretDigest,isValidSetupToken,validTotpCode} from '@/lib/registration';
export const runtime='nodejs';
export async function POST(request){
 try{
  postGuard(request);
  const sql=db();
  await limitAdminRegistration(sql,request);
  const {setupToken,code}=await limitedJSON(request);
  if(!isValidSetupToken(setupToken)||!validTotpCode(code))throw new PublicError('Código ou confirmação inválidos.',400);
  const result=await sql.begin(async tx=>{
   const [pending]=await tx`SELECT e.token_hash,e.expires_at,e.failures,u.id,u.totp_secret,u.organization_id,u.email
    FROM admin_enrollments e JOIN admin_users u ON u.id=e.user_id
    WHERE e.token_hash=${secretDigest(setupToken)} AND u.active=FALSE FOR UPDATE OF e`;
   if(!pending||new Date(pending.expires_at).getTime()<=Date.now()||pending.failures>=5)
    throw new PublicError('Ativação inválida ou expirada. Solicite um novo convite.',403);
   const step=verifyTotp(decryptMfaSecret(pending.totp_secret),code);
   if(step===false){
    await tx`UPDATE admin_enrollments SET failures=failures+1 WHERE token_hash=${pending.token_hash}`;
    return null;
   }
   const [activated]=await tx`UPDATE admin_users SET active=TRUE,last_totp_step=${step}
     WHERE id=${pending.id} AND active=FALSE RETURNING id`;
   if(!activated)throw new PublicError('Conta já ativada.',409);
   await tx`DELETE FROM admin_enrollments WHERE token_hash=${pending.token_hash}`;
   return {organizationId:pending.organization_id,email:pending.email};
  });
  if(!result)throw new PublicError('Código MFA incorreto. Confira o relógio e tente novamente.',401);
  return Response.json({ok:true,...result},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return asError(e)}
}
