import {db} from '@/lib/db';
import {sha256,postGuard,asError} from '@/lib/security';
export const runtime='nodejs';
export async function POST(req){
 try{
  postGuard(req);const session=req.cookies.get('admin_session')?.value;
  if(session&&/^[a-f0-9]{64}$/.test(session))await db()`DELETE FROM admin_sessions WHERE session_hash=${sha256(session)}`;
  const response=Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
  response.headers.append('Set-Cookie',`admin_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${process.env.NODE_ENV==='production'?'; Secure':''}`);
  return response;
 }catch(e){return asError(e)}
}
