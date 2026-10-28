import {db} from '@/lib/db';
import {adminContext,originAllowed,asError,PublicError} from '@/lib/security';
import {validateVoters,voterDigest,encryptVoterName,decryptVoterName} from '@/lib/institution';
export const runtime='nodejs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
async function context(req,params){
 const admin=await adminContext(req.cookies.get('admin_session')?.value);
 if(!admin)throw new PublicError('Autenticação necessária',401);
 const {id}=await params;
 if(!UUID.test(id||''))throw new PublicError('Eleição inválida',400);
 const [e]=await db()`SELECT id,organization_id,starts_at FROM elections WHERE id=${id} AND organization_id=${admin.organization_id}`;
 if(!e)throw new PublicError('Eleição não encontrada nesta instituição',404);
 return {admin,id};
}
export async function GET(req,{params}){
 try{
  const {admin,id}=await context(req,params);
  const [count]=await db()`SELECT COUNT(*)::int AS total FROM eligible_voters WHERE election_id=${id}`;
  if(admin.role==='auditor')return Response.json({total:count.total},{headers:{'Cache-Control':'no-store'}});
  const offset=Math.min(10000,Math.max(0,Number(new URL(req.url).searchParams.get('offset'))||0));
  const rows=await db()`SELECT identifier_digest,encrypted_name FROM eligible_voters WHERE election_id=${id} ORDER BY identifier_digest LIMIT 40 OFFSET ${offset}`;
  return Response.json({total:count.total,entries:rows.map(row=>({reference:row.identifier_digest.slice(0,12),name:decryptVoterName(id,row.encrypted_name)}))},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return asError(e)}
}
export async function POST(req,{params}){
 try{
  if(!originAllowed(req))throw new PublicError('Origem não autorizada',403);
  if(req.headers.get('content-type')?.split(';')[0]!=='application/json')throw new PublicError('Envie JSON',415);
  const {admin,id}=await context(req,params);
  if(admin.role==='auditor')throw new PublicError('Somente gestores podem cadastrar aptos',403);
  const raw=await req.text();if(Buffer.byteLength(raw)>120000)throw new PublicError('Lote muito grande',413);
  let payload;try{payload=JSON.parse(raw)}catch{throw new PublicError('JSON inválido',400)}
  let validated;try{validated=validateVoters(payload.entries)}catch(e){throw new PublicError(e.message,400)}
  const rows=validated.map(v=>({identifier_digest:voterDigest(id,v.identifier),encrypted_name:encryptVoterName(id,v.name)}));
  const result=await db().begin(async tx=>{
   const [e]=await tx`SELECT id FROM elections WHERE id=${id} AND organization_id=${admin.organization_id} AND starts_at>NOW() FOR UPDATE`;
   if(!e)throw new PublicError('Cadastro fechado ou eleição de outra instituição',409);
   const [hasTokens]=await tx`SELECT EXISTS(SELECT 1 FROM voter_tokens WHERE election_id=${id}) AS issued`;
   if(hasTokens.issued)throw new PublicError('Cadastre todos os aptos ANTES de emitir credenciais',409);
   const [count]=await tx`SELECT COUNT(*)::int AS total FROM eligible_voters WHERE election_id=${id}`;
   if(count.total+rows.length>10000)throw new PublicError('Limite de 10.000 aptos por eleição',409);
   const inserted=await tx`
     INSERT INTO eligible_voters(election_id,identifier_digest,encrypted_name)
     SELECT ${id}, x.identifier_digest, x.encrypted_name
     FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS x(identifier_digest text,encrypted_name text)
     RETURNING identifier_digest`;
   await tx`INSERT INTO admin_activity(organization_id,election_id,actor_id,action,detail)
    VALUES(${admin.organization_id},${id},${admin.id},'roster_import',${`${rows.length} aptos inseridos`})`;
   return {imported:inserted.length,total:count.total+inserted.length};
  });
  return Response.json(result,{status:201,headers:{'Cache-Control':'no-store'}});
 }catch(e){
  if(e?.code==='23505')return Response.json({error:'Há identificadores já cadastrados. Revise os duplicados e envie novamente o lote.'},{status:409,headers:{'Cache-Control':'no-store'}});
  return asError(e);
 }
}
