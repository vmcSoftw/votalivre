import {db} from '@/lib/db';
import {verifyManifest} from '@/lib/audit';
import {fetchPublicDashboard} from '@/lib/public-dashboard-db';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(_request,{params}){
 const {id}=await params;
 if(!/^[a-f0-9-]{36}$/i.test(id||''))return Response.json({error:'Identificador inválido'},{status:400});
 try{const state=await fetchPublicDashboard(id);if(!state)return Response.json({error:'Eleição não encontrada'},{status:404,headers:{'Cache-Control':'no-store'}});if(state.status!=='published')return Response.json({error:'Manifesto público disponível somente após encerramento e endossos da comissão'},{status:403,headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Auditoria indisponível: documento não validado'},{status:503,headers:{'Cache-Control':'no-store'}});}
 const [snap]=await db()`SELECT manifest_text,signature_base64url,public_key_pem FROM audit_snapshots WHERE election_id=${id}`;
 if(!snap)return Response.json({error:'Manifesto ainda não disponível após o encerramento'},{status:404,headers:{'Cache-Control':'no-store'}});
 if(!verifyManifest(snap.manifest_text,snap.signature_base64url,snap.public_key_pem))return Response.json({error:'Integridade do manifesto comprometida'},{status:503});
 return Response.json({manifestText:snap.manifest_text,manifest:JSON.parse(snap.manifest_text),signature:snap.signature_base64url,publicKeyPem:snap.public_key_pem,warning:'Valide a chave pública por canal independente. Esta assinatura não prova ausência de adulteração antes da lacração.'},{headers:{'Cache-Control':'public, max-age=60', 'X-Content-Type-Options':'nosniff'}});
}
