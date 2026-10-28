import {db} from '@/lib/db';
import {adminContext,postGuard,limitedJSON,asError,PublicError} from '@/lib/security';
export const runtime='nodejs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export async function POST(req,context){
 try{
  postGuard(req);const admin=await adminContext(req.cookies.get('admin_session')?.value);
  if(!admin)throw new PublicError('Acesso não autorizado',401);
  if(admin.role!=='owner')throw new PublicError('Somente responsável principal pode cancelar lotes',403);
  const {id}=await context.params,{batchId}=await limitedJSON(req);
  if(!UUID.test(id||'')||!UUID.test(batchId||''))throw new PublicError('Lote inválido');
  const cancelled=await db().begin(async tx=>{
   const [batch]=await tx`SELECT b.id FROM issue_batches b JOIN elections e ON b.election_id=e.id WHERE b.id=${batchId} AND b.election_id=${id} AND e.organization_id=${admin.organization_id} AND e.starts_at>NOW() FOR UPDATE OF b`;
   if(!batch)throw new PublicError('Lote não encontrado ou eleição já iniciada',409);
   const [changed]=await tx`WITH changed AS (UPDATE voter_tokens SET revoked_at=NOW() WHERE issue_batch_id=${batchId} AND used_at IS NULL AND revoked_at IS NULL RETURNING id) SELECT COUNT(*)::int AS quantity FROM changed`;
   await tx`UPDATE issue_batches SET pins_ciphertext=NULL,revoked_at=NOW() WHERE id=${batchId} AND revoked_at IS NULL`;
   return changed.quantity;
  });
  return Response.json({revoked:cancelled},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return asError(e)}
}
