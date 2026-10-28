import {db} from '@/lib/db';
import {adminContext,postGuard,limitedJSON,asError,PublicError} from '@/lib/security';
export const runtime='nodejs';
export async function PATCH(req){
 try{
  postGuard(req);const admin=await adminContext(req.cookies.get('admin_session')?.value);
  if(!admin||admin.role!=='owner')throw new PublicError('Somente o responsável principal pode alterar a instituição',403);
  const d=await limitedJSON(req);
  if(!['school','company','association','other'].includes(d.type))throw new PublicError('Tipo de instituição inválido',400);
  const name=String(d.name||'').trim();
  if(name.length<2||name.length>120)throw new PublicError('Nome deve conter de 2 a 120 caracteres',400);
  await db().begin(async tx=>{
   await tx`UPDATE organizations SET name=${name},organization_type=${d.type} WHERE id=${admin.organization_id}`;
   await tx`INSERT INTO admin_activity(organization_id,actor_id,action,detail) VALUES(${admin.organization_id},${admin.id},'organization_updated','Nome ou categoria institucional atualizados')`;
  });
  return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return asError(e)}
}
