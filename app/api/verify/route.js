import {db} from '@/lib/db';
import {postGuard,limitedJSON,asError,PublicError,sha256} from '@/lib/security';
import {verifyManifest,merkleRoot} from '@/lib/audit';
import {fetchPublicDashboard} from '@/lib/public-dashboard-db';
export const runtime='nodejs';
export async function POST(req){
 try{
  postGuard(req);const {electionId,receipt}=await limitedJSON(req);
  if(typeof receipt!=='string'||receipt.length<24||receipt.length>100||!/^[a-f0-9-]{36}$/i.test(electionId||''))throw new PublicError('Informe um comprovante válido.');
  // A confirmação do recibo só utiliza documentos efetivamente autorizados para divulgação.
  const publication=await fetchPublicDashboard(electionId);
  if(!publication)throw new PublicError('Eleição não encontrada',404);
  if(publication.status!=='published')throw new PublicError('Conferência disponível após lacração, endossos e verificação das âncoras da comissão.',409);
  const sql=db();
  const [snapshot]=await sql`SELECT manifest_text,signature_base64url,public_key_pem FROM audit_snapshots WHERE election_id=${electionId}`;
  if(!snapshot)throw new PublicError('A comissão ainda não lacrou os registros de votação.',409);
  if(!verifyManifest(snapshot.manifest_text,snapshot.signature_base64url,snapshot.public_key_pem))throw new PublicError('Falha de integridade no manifesto de auditoria.',503);
  const manifest=JSON.parse(snapshot.manifest_text);
  const hashes=manifest.commitments.receiptHashes;
  if(merkleRoot('receipts',hashes)!==manifest.commitments.receiptsRoot)throw new PublicError('O conjunto de recibos está inconsistente.',503);
  return Response.json({included:hashes.includes(sha256(receipt.trim())),source:'manifesto-assinado'},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return asError(e)}
}
