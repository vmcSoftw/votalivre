import {db} from '@/lib/db';
import {verifyCommitteeCertificate,committeeRosterFingerprint} from '@/lib/committee';
import {notFound} from 'next/navigation';
import {fetchPublicDashboard} from '@/lib/public-dashboard-db';
export const dynamic='force-dynamic';
export default async function CommissionPage({params}){
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id||''))notFound();
 let state;try{state=await fetchPublicDashboard(id)}catch{return <div className="narrow error"><h1>Certificado indisponível</h1><p>Os documentos não passaram na verificação.</p></div>;}
 if(!state)notFound();
 if(state.status!=='published')return <div className="narrow"><h1>Comissão fiscalizadora</h1><div className="panel"><h2>Aguardando publicação</h2><p>{state.message} Não exibiremos apuração antes da autorização documental.</p></div></div>;
 const [e]=await db()`SELECT title,organization_name FROM elections WHERE id=${id}`;
 if(!e)notFound();
 const [row]=await db()`SELECT certificate_text,published_at FROM committee_certificates WHERE election_id=${id}`;
 if(!row)return <div className="narrow"><div className="eyebrow">COMISSÃO FISCALIZADORA</div><h1>{e.title}</h1><div className="panel"><h2>Endossos independentes ainda não publicados</h2><p>A existência de um manifesto assinado não equivale à aprovação por membros da comissão. O resultado permanece sujeito a fiscalização independente.</p><a className="text-link" href={`/auditoria/${id}`}>Ver manifesto da apuração</a></div></div>;
 let check,cert;
 try{cert=JSON.parse(row.certificate_text);check=verifyCommitteeCertificate({certificate:cert,trustedSealKeyPem:cert.attestation.publicKeyPem,trustedRoster:cert.roster});}
 catch{return <div className="narrow"><h1>Certificado inválido</h1><div className="error">Foi detectada uma inconsistência no certificado. Não o utilize como confirmação da apuração.</div></div>;}
 return <div className="container commission-container"><div className="eyebrow">VOTALIVRE • COMISSÃO FISCALIZADORA</div><h1>Conferência por múltiplos auditores</h1><p className="muted">{e.organization_name} · {e.title}</p>
 <div className="stats"><div className="panel"><div className="stat">{check.approved.length}/{cert.roster.members.length}</div><div className="muted">Endossos publicados</div></div><div className="panel"><div className="stat">{check.required}</div><div className="muted">Quórum mínimo</div></div><div className="panel"><div className="stat">{check.ballots.toLocaleString('pt-BR')}</div><div className="muted">Cédulas no manifesto</div></div></div>
 <div className="commission-layout"><section className="panel"><h2>Auditores que assinaram</h2>{cert.roster.members.map(m=><div key={m.id} className="commission-person"><div><strong>{m.name}</strong><div className="muted small">Identificador: {m.id}</div></div><span className={check.approved.includes(m.id)?'status':'commission-pending'}>{check.approved.includes(m.id)?'Endosso válido':'Sem endosso'}</span></div>)}<a className="btn" href={`/api/comissao/${id}`}>Obter certificado público JSON</a></section>
 <aside className="panel"><h2>Impressões de conferência</h2><p className="muted small">Compare com cópias publicadas fora do servidor, antes da eleição.</p><div className="audit-code-label">Lista da comissão — SHA-256</div><code className="commission-hash">{committeeRosterFingerprint(cert.roster)}</code><div className="audit-code-label">Manifesto — SHA-256</div><code className="commission-hash">{check.manifestSha256}</code><p className="muted small">A conferência deste site utiliza as chaves contidas no certificado; sem comparação com fontes independentes, não demonstra autenticidade externa.</p></aside></div>
 <div className="notice audit-alert"><strong>Alcance desta conferência:</strong> as assinaturas correspondem às chaves declaradas e ao mesmo manifesto, mas não certificam que o eleitor votou sem coação, que o dispositivo não estava comprometido nem que os dados eram corretos antes da lacração. Não publique os pacotes confidenciais contendo a chave da eleição.</div>
 </div>;
}
