import {db} from '@/lib/db';
import {verifyManifest} from '@/lib/audit';
import {sha256} from '@/lib/crypto';
import {fetchPublicDashboard} from '@/lib/public-dashboard-db';
import {notFound} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Auditing({params}){
 const {id}=await params;
 if(!/^[a-f0-9-]{36}$/i.test(id||''))notFound();
 let published;try{published=await fetchPublicDashboard(id)}catch{return <div className="narrow error"><h1>Auditoria bloqueada</h1><p>Não foi possível validar os documentos da apuração.</p></div>;}
 if(!published)notFound();
 if(published.status!=='published')return <div className="narrow"><div className="eyebrow">AUDITORIA INSTITUCIONAL</div><h1>{published.title}</h1><div className="panel"><h2>Documento de apuração ainda não publicado</h2><p>{published.message} A publicação pública exige fechamento, lacração e endossos da comissão.</p></div></div>;
 const sql=db();
 const [e]=await sql`SELECT title,organization_name,ends_at FROM elections WHERE id=${id}`;
 if(!e)notFound();
 const [sealed]=await sql`SELECT manifest_text,signature_base64url,public_key_pem FROM audit_snapshots WHERE election_id=${id}`;
 if(!sealed)return <div className="narrow"><div className="eyebrow">AUDITORIA INSTITUCIONAL</div><h1>{e.title}</h1><div className="panel"><h2>Auditoria aguardando lacração</h2><p>Após o encerramento, a comissão deverá gerar e assinar o manifesto. Nenhuma contagem é apresentada como certificada enquanto o documento não existir.</p></div></div>;
 const valid=verifyManifest(sealed.manifest_text,sealed.signature_base64url,sealed.public_key_pem);
 if(!valid)return <div className="narrow"><h1>Alerta de integridade</h1><div className="error">A assinatura do manifesto não é válida. Não utilize esses números como resultado.</div></div>;
 const m=JSON.parse(sealed.manifest_text);
 const fingerprint=sha256(sealed.manifest_text);
 const totalValid=m.options.filter(x=>x.kind==='candidate').reduce((a,b)=>a+b.votes,0);
 return <div className="container audit-container"><div className="eyebrow">◈ AUDITORIA PÚBLICA • DOCUMENTO DE ENCERRAMENTO</div><div className="headline"><div><h1>Transparência da apuração</h1><p className="muted">{m.election.organization} · {m.election.title}</p></div><span className="audit-tag">✓ Assinatura matematicamente válida</span></div>
 <div className="stats"><div className="panel"><div className="stat">{m.totals.ballots.toLocaleString('pt-BR')}</div><div className="muted">Votos no manifesto</div></div><div className="panel"><div className="stat">{m.totals.receipts.toLocaleString('pt-BR')}</div><div className="muted">Recibos comprometidos</div></div><div className="panel"><div className="stat">{m.totals.used.toLocaleString('pt-BR')}</div><div className="muted">Credenciais utilizadas</div></div></div>
 <div className="audit-layout"><section className="panel"><h2>Contagem divulgada</h2>{m.options.map(o=><div className="result-row" key={o.id}><div className="spread"><strong>{o.label}</strong><span>{o.votes.toLocaleString('pt-BR')} votos</span></div>{o.kind==='candidate'&&<div className="progress"><div style={{width:`${totalValid?100*o.votes/totalValid:0}%`}}/></div>}</div>)}<a className="btn" href={`/api/auditoria/${id}`} download={`auditoria-${id}.json`}>Consultar manifesto assinado ↗</a></section>
 <aside className="panel audit-side"><h2>Impressões criptográficas</h2><p className="muted small">Guarde esses códigos em um repositório independente. Qualquer alteração no manifesto depois da assinatura modifica sua impressão SHA-256.</p><div className="audit-code-label">Documento assinado — SHA-256</div><code className="audit-code">{fingerprint}</code><div className="audit-code-label">Raiz das cédulas</div><code className="audit-code">{m.commitments.ballotsRoot}</code><div className="audit-code-label">Raiz dos recibos</div><code className="audit-code">{m.commitments.receiptsRoot}</code><p className="muted small">O arquivo público apresenta compromissos e contagens, mas não inclui votos em claro nem a chave de decriptação.</p></aside></div>
 <a className="text-link" href={`/comissao/${id}`}>Consultar endossos independentes da comissão →</a><div className="notice audit-alert"><strong>Limite importante:</strong> a validade criptográfica é verificada com a chave exibida neste site. A comissão deve conferir sua autenticidade por outro canal e executar o verificador offline com o pacote confidencial. A assinatura não demonstra que os votos eram corretos antes do fechamento.</div>
 </div>;
}
