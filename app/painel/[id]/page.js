import PublicDashboard from '@/components/PublicDashboard';
import {notFound} from 'next/navigation';
export const dynamic='force-dynamic';
export const metadata={title:'Central de Apuração | VotaLivre',description:'Divulgação de resultados institucionais após encerramento, lacração e aprovação pela comissão.'};
export default async function Page({params}){
 const {id}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||''))notFound();
 return <PublicDashboard electionId={id}/>;
}
