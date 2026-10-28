import {db} from '@/lib/db';
import {adminContext,postGuard,limitedJSON,asError,PublicError} from '@/lib/security';
export const runtime='nodejs';
const UUID=/^[a-f0-9-]{36}$/i;
export async function PATCH(req,{params}){
 try{
  postGuard(req);
  const admin=await adminContext(req.cookies.get('admin_session')?.value);
  if(!admin||admin.role!=='owner')throw new PublicError('Apenas a conta responsável pode gerenciar permissões',403);
  const {id}=await params;
  if(!UUID.test(id||'')||id===admin.id)throw new PublicError('Não é permitido alterar a própria conta',400);
  const data=await limitedJSON(req);
  if(typeof data.active!=='boolean'||!['manager','auditor'].includes(data.role))throw new PublicError('Permissão inválida',400);
  await db().begin(async tx=>{
   await tx`SELECT id FROM organizations WHERE id=${admin.organization_id} FOR UPDATE`;
   const [user]=await tx`SELECT id,role FROM admin_users WHERE id=${id} AND organization_id=${admin.organization_id} FOR UPDATE`;
   if(!user||user.role==='owner')throw new PublicError('Não é permitido alterar ou desativar outro responsável principal por esta página',409);
   await tx`UPDATE admin_users SET active=${data.active},role=${data.role} WHERE id=${id} AND organization_id=${admin.organization_id}`;
   if(!data.active)await tx`DELETE FROM admin_sessions WHERE user_id=${id}`;
   await tx`INSERT INTO admin_activity(organization_id,actor_id,action,detail) VALUES(${admin.organization_id},${admin.id},'admin_permission_changed',${`Conta ${id}: ${data.role}; ativo=${data.active}`})`;
  });
  return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return asError(e)}
}
