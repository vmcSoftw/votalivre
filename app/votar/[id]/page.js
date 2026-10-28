import {db} from '@/lib/db';
import {notFound} from 'next/navigation';
import VotingForm from '@/components/VotingForm';
import PrivacyScreen from '@/components/PrivacyScreen';
export const dynamic='force-dynamic';
export default async function VotePage({params}){
  const {id}=await params;
  const [e]=await db()`SELECT id,organization_name,title,description,starts_at,ends_at FROM elections WHERE id=${id}`;
  if(!e)notFound();
  const options=await db()`SELECT id,label,kind FROM ballot_options WHERE election_id=${id} ORDER BY position`;
  return <div className="narrow vote-screen"><div className="eyebrow">CÉDULA DIGITAL PROTEGIDA • {e.organization_name}</div><h1>{e.title}</h1><p className="muted">{e.description}</p><PrivacyScreen><VotingForm electionId={e.id} options={options} startsAt={e.starts_at.toISOString()} endsAt={e.ends_at.toISOString()}/></PrivacyScreen><p className="privacy-footnote">Sua escolha não aparece no comprovante. A captura de tela não pode ser tecnicamente impedida em todos os navegadores ou dispositivos.</p></div>;
}
