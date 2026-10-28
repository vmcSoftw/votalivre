import {db} from '@/lib/db';
import {adminContext,asError,PublicError} from '@/lib/security';
import {verifyManifest} from '@/lib/audit';
import {resultCsv} from '@/lib/institution';
export const runtime='nodejs';
export async function GET(req,{params}){
 try{
  const admin=await adminContext(req.cookies.get('admin_session')?.value);
  if(!admin)throw new PublicError('Autenticação necessária',401);
  const {id}=await params;
  if(!/^[a-f0-9-]{36}$/i.test(id||''))throw new PublicError('Eleição inválida',400);
  const [e]=await db()`SELECT id,title,organization_name FROM elections WHERE id=${id} AND organization_id=${admin.organization_id}`;
  if(!e)throw new PublicError('Eleição não encontrada nesta instituição',404);
  const [snap]=await db()`SELECT manifest_text,signature_base64url,public_key_pem FROM audit_snapshots WHERE election_id=${id}`;
  if(!snap)throw new PublicError('Resultado ainda não lacrado',409);
  if(!verifyManifest(snap.manifest_text,snap.signature_base64url,snap.public_key_pem))throw new PublicError('Assinatura inválida',409);
  const m=JSON.parse(snap.manifest_text);
  if(m.election.id!==id)throw new PublicError('Manifesto inconsistente',409);
  const csv=resultCsv({title:e.title,organization:e.organization_name,options:m.options,totals:m.totals,governance:m.governance});
  return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="resultado-${id}.csv"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){return asError(e)}
}
