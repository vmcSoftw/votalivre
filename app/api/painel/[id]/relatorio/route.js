import {fetchPublicDashboard} from '@/lib/public-dashboard-db';
import {publicResultsCsv} from '@/lib/public-dashboard';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const common={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
export async function GET(_request,{params}){
 const {id}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||''))return Response.json({error:'ID inválido'},{status:400,headers:common});
 try{const result=await fetchPublicDashboard(id);
  if(!result)return Response.json({error:'Eleição não encontrada'},{status:404,headers:common});
  if(result.status!=='published')return Response.json({error:'Relatório indisponível até lacração e aprovação da comissão'},{status:403,headers:common});
  return new Response(publicResultsCsv(result),{headers:{...common,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="votalivre-relatorio-${id}.csv"`}});
 }catch(error){console.error('Falha no relatório público:',error instanceof Error?error.message:'erro desconhecido');return Response.json({error:'Verificação do relatório não concluída'},{status:503,headers:common});}
}
