import {fetchPublicDashboard} from '@/lib/public-dashboard-db';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store, max-age=0, must-revalidate','X-Content-Type-Options':'nosniff'};
export async function GET(_request,{params}){
 const {id}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||''))return Response.json({error:'Identificador inválido'},{status:400,headers});
 try{const result=await fetchPublicDashboard(id);return result?Response.json(result,{headers}):Response.json({error:'Eleição não encontrada'},{status:404,headers});}
 catch(error){console.error('Falha na projeção pública de apuração:',error instanceof Error?error.message:'erro desconhecido');return Response.json({error:'Não foi possível validar os documentos da apuração. Resultados bloqueados.'},{status:503,headers});}
}
