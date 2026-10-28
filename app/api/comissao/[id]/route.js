import {db} from '@/lib/db';
import {verifyCommitteeCertificate} from '@/lib/committee';
import {fetchPublicDashboard} from '@/lib/public-dashboard-db';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(_request,{params}){
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id||''))return Response.json({error:'Identificador inválido'},{status:400});
 try{const state=await fetchPublicDashboard(id);if(!state)return Response.json({error:'Eleição não encontrada'},{status:404,headers:{'Cache-Control':'no-store'}});if(state.status!=='published')return Response.json({error:'Certificado público indisponível até o encerramento e a verificação dos endossos'},{status:403,headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Certificado não validado'},{status:503,headers:{'Cache-Control':'no-store'}});}
 const [row]=await db()`SELECT certificate_text FROM committee_certificates WHERE election_id=${id}`;
 if(!row)return Response.json({error:'Endossos ainda não publicados'},{status:404,headers:{'Cache-Control':'no-store'}});
 try{
  const certificate=JSON.parse(row.certificate_text);
  verifyCommitteeCertificate({certificate,trustedSealKeyPem:certificate.attestation.publicKeyPem,trustedRoster:certificate.roster});
  return Response.json({certificate,warning:'A confirmação externa das chaves da comissão e da lacração é indispensável. Verifique com cópias registradas antes da eleição.'},{headers:{'Cache-Control':'public, max-age=60','X-Content-Type-Options':'nosniff'}});
 }catch{return Response.json({error:'Endossos com assinatura inválida'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
