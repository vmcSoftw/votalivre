import {redirect,notFound} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Page({params}){
 const {id}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||''))notFound();
 redirect(`/painel/${id}`);
}
