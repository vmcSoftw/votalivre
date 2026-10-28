import {db} from '@/lib/db';
import {adminContext,postGuard,limitedJSON,asError,PublicError} from '@/lib/security';
export const runtime='nodejs';
export async function POST(req){
 try{
  postGuard(req);const admin=await adminContext(req.cookies.get('admin_session')?.value);
  if(!admin)throw new PublicError('Acesso não autorizado',401);
  if(admin.role==='auditor')throw new PublicError('Ação restrita a gestores',403);
  const body=await limitedJSON(req);const title=String(body.title||'').trim();const description=String(body.description||'').trim();
  const labels=Array.isArray(body.options)?body.options.map(x=>String(x).trim()).filter(Boolean):[];
  const start=new Date(body.startsAt),end=new Date(body.endsAt);
  const electionType=String(body.electionType||'other');
  const quorumPercent=Number(body.quorumPercent??0);
  const tieRule=String(body.tieRule||'commission');
  if(!['student','staff','cipa','council','association','other'].includes(electionType)||!Number.isInteger(quorumPercent)||quorumPercent<0||quorumPercent>100||!['commission','runoff'].includes(tieRule))throw new PublicError('Regras institucionais inválidas',400);
  if(title.length<3||title.length>160||description.length>1500||labels.length<2||labels.length>20||labels.some(x=>x.length<2||x.length>160)||new Set(labels.map(x=>x.toLocaleLowerCase('pt-BR'))).size!==labels.length||isNaN(+start)||isNaN(+end)||+start<=Date.now()+60_000||+end<=+start||+end-(+start)>1000*60*60*24*30)throw new PublicError('Confira título, candidatos e datas. A abertura deve ser futura e o período deve durar até 30 dias.');
  const sql=db();const id=await sql.begin(async tx=>{
   const [org]=await tx`SELECT name FROM organizations WHERE id=${admin.organization_id}`;
   if(!org)throw new PublicError('Organização não encontrada',404);
   const [e]=await tx`INSERT INTO elections(organization_id,organization_name,title,description,starts_at,ends_at,election_type,quorum_percent,tie_rule) VALUES(${admin.organization_id},${org.name},${title},${description},${start.toISOString()},${end.toISOString()},${electionType},${quorumPercent},${tieRule}) RETURNING id`;
   for(let i=0;i<labels.length;i++)await tx`INSERT INTO ballot_options(election_id,label,kind,position) VALUES(${e.id},${labels[i]},'candidate',${i+1})`;
   await tx`INSERT INTO ballot_options(election_id,label,kind,position) VALUES(${e.id},'Voto em branco','blank',10000)`;
   await tx`INSERT INTO ballot_options(election_id,label,kind,position) VALUES(${e.id},'Voto nulo','null',10001)`;
   await tx`INSERT INTO admin_activity(organization_id,election_id,actor_id,action,detail) VALUES(${admin.organization_id},${e.id},${admin.id},'election_created','Eleição criada com regras de quórum e empate')`;
   return e.id;
  });return Response.json({id},{status:201,headers:{'Cache-Control':'no-store'}});
 }catch(e){return asError(e)}
}
