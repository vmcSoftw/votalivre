import {randomBytes} from 'node:crypto';
import {db} from '@/lib/db';
import {postGuard,limitedJSON,asError,PublicError,passwordHash,encodeBase32,encryptMfaSecret} from '@/lib/security';
import {limitAdminRegistration} from '@/lib/limits';
import {registrationFields,secretDigest} from '@/lib/registration';
export const runtime='nodejs';
export async function POST(request){
 try{
  postGuard(request);
  const sql=db();
  await limitAdminRegistration(sql,request);
  let fields;
  try{fields=registrationFields(await limitedJSON(request));}
  catch(e){throw new PublicError(e.message,400)}
  const hash=secretDigest(fields.invitation);
  const totpSecret=encodeBase32(randomBytes(20));
  const setupToken=randomBytes(32).toString('hex');
  const pwdHash=await passwordHash(fields.password);
  const organizationId=await sql.begin(async tx=>{
   // UPDATE com condição e RETURNING fornece consumo atômico, mesmo sob concorrência.
   const [invite]=await tx`UPDATE organization_registration_invites SET consumed_at=NOW()
     WHERE code_hash=${hash} AND consumed_at IS NULL AND expires_at>NOW() RETURNING code_hash`;
   if(!invite)throw new PublicError('Convite inválido, expirado ou já utilizado.',403);
   const [organization]=await tx`INSERT INTO organizations(name) VALUES(${fields.organization}) RETURNING id`;
   const [user]=await tx`INSERT INTO admin_users(organization_id,email,password_hash,totp_secret,role,active)
      VALUES(${organization.id},${fields.email},${pwdHash},${encryptMfaSecret(totpSecret)},'owner',FALSE) RETURNING id`;
   await tx`INSERT INTO admin_enrollments(token_hash,user_id,expires_at)
      VALUES(${secretDigest(setupToken)},${user.id},NOW()+INTERVAL '15 minutes')`;
   await tx`UPDATE organization_registration_invites SET organization_id=${organization.id} WHERE code_hash=${hash}`;
   return organization.id;
  });
  const otpUri=`otpauth://totp/${encodeURIComponent('VotaLivre:'+fields.email)}?secret=${totpSecret}&issuer=VotaLivre&algorithm=SHA1&digits=6&period=30`;
  return Response.json({organizationId,setupToken,totpSecret,otpUri},{status:201,headers:{'Cache-Control':'no-store','Pragma':'no-cache'}});
 }catch(e){return asError(e)}
}
