import {db} from '@/lib/db';
import {decryptPinBatch} from '@/lib/issuance';
import {adminContext,postGuard,limitedJSON,asError,PublicError} from '@/lib/security';
export const runtime='nodejs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export async function POST(req,context){
 try{
  postGuard(req);const admin=await adminContext(req.cookies.get('admin_session')?.value);
  if(!admin)throw new PublicError('Acesso não autorizado',401);
  if(admin.role==='auditor')throw new PublicError('Ação restrita a gestores',403);
  const {id}=await context.params,{batchId}=await limitedJSON(req);
  if(!UUID.test(id||'')||!UUID.test(batchId||''))throw new PublicError('Lote inválido');
  return await db().begin(async tx=>{
   // Bloqueio antes de consumir; a entrega é irreversível.
   const [batch]=await tx`
     SELECT b.id,b.pins_ciphertext,b.created_by,b.election_id
     FROM issue_batches b JOIN elections e ON b.election_id=e.id
     WHERE b.id=${batchId} AND b.election_id=${id} AND e.organization_id=${admin.organization_id}
      AND e.starts_at>NOW() AND b.delivered_at IS NULL AND b.revoked_at IS NULL FOR UPDATE OF b`;
   if(!batch)throw new PublicError('Lote não disponível para entrega. Confira o número ou se já foi entregue.',409);
   if(batch.created_by===admin.id)throw new PublicError('A entrega deve ser feita por outro gestor.',403);
   const pins=decryptPinBatch(batch.id,id,batch.pins_ciphertext);
   await tx`UPDATE issue_batches SET pins_ciphertext=NULL,delivered_at=NOW(),delivered_by=${admin.id} WHERE id=${batchId}`;
   return Response.json({batchId,pins},{headers:{'Cache-Control':'no-store'}});
  });
 }catch(e){return asError(e)}
}
