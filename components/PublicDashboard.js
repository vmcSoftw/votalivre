'use client';
import {useCallback,useEffect,useState} from 'react';
const format = n => Number(n||0).toLocaleString('pt-BR');
const percentage = n => `${Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}%`;
const date = s => s?new Date(s).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'Não informado';
const statusName={scheduled:'Programada',voting:'Em votação',awaiting_seal:'Aguardando lacração',awaiting_committee:'Aguardando comissão',awaiting_trust:'Aguardando chaves confiadas',published:'Resultados divulgados'};
function Stat({caption,value,detail}){return <section className="pv-stat"><span>{caption}</span><strong>{value}</strong>{detail&&<small>{detail}</small>}</section>}
function Results({data}){
 const t=data.totals;const candidates=data.options.filter(x=>x.kind==='candidate');
 return <>
  <div className="pv-metrics" aria-label="Resumo da apuração">
   <Stat caption="Votos computados" value={format(t.ballots)} detail="Cédulas registradas"/>
   <Stat caption="Votos válidos" value={format(t.valid)} detail="Somente candidatos / chapas"/>
   <Stat caption="Comparecimento" value={t.participation===null?'Não informado':percentage(t.participation)} detail={t.eligible===null?'Sem lista de aptos':`${format(t.used)} de ${format(t.eligible)} aptos`}/>
   <Stat caption="Brancos + nulos" value={format(t.blank+t.nullVotes)} detail={`${format(t.blank)} brancos · ${format(t.nullVotes)} nulos`}/>
  </div>
  <div className="pv-content-grid">
   <section className="pv-card" aria-labelledby="pv-candidates"><div className="pv-section-head"><div><p className="pv-overline">CONTAGEM POR OPÇÃO</p><h2 id="pv-candidates">Resultado da votação</h2></div><span className="pv-small-tag">Votos válidos: {format(t.valid)}</span></div>
    {candidates.length? <ol className="pv-candidates" aria-label="Candidatos e seus votos">
     {candidates.map((candidate,i)=><li key={candidate.id} className="pv-choice"><div className="pv-choice-head"><div className="pv-choice-name"><span className="pv-choice-index" aria-hidden="true">{String(i+1).padStart(2,'0')}</span><strong>{candidate.label}</strong></div><div className="pv-choice-numbers"><b>{format(candidate.votes)} <small>votos</small></b><span>{percentage(candidate.percentage)}</span></div></div><div className="pv-track" role="progressbar" aria-label={`Percentual dos votos válidos para ${candidate.label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={candidate.percentage||0}><div style={{width:`${Math.max(0,Math.min(100,candidate.percentage||0))}%`}}/></div></li>)}
    </ol>:<p>Esta eleição não apresenta opções do tipo candidato.</p>}
    <div className="pv-breakdown"><div><span>Votos em branco</span><strong>{format(t.blank)}</strong></div><div><span>Votos nulos</span><strong>{format(t.nullVotes)}</strong></div><div><span>Abstenções</span><strong>{t.abstentions===null?'Não informado':format(t.abstentions)}</strong></div></div>
   </section>
   <aside className="pv-side">
    <section className="pv-card"><p className="pv-overline">TRANSPARÊNCIA</p><h2>Fiscalização independente</h2><div className="pv-approval"><b>{data.approval.approved} / {data.approval.totalMembers}</b><span>Fiscais que endossaram o manifesto</span></div><div className="pv-info-line"><span>Mínimo exigido</span><b>{data.approval.required} assinaturas</b></div><div className="pv-info-line"><span>Encerramento</span><b>{date(data.endsAt)}</b></div><div className="pv-info-line"><span>Lacração</span><b>{date(data.sealedAt)}</b></div><a className="pv-inline-link" href={`/comissao/${data.id}`}>Verificar endossos da comissão ↗</a></section>
    <section className="pv-card"><p className="pv-overline">IMPRONTA DIGITAL</p><h2>Integridade do manifesto</h2><p className="pv-muted">SHA-256 do documento que contém a apuração assinada:</p><code className="pv-fingerprint">{data.manifestSha256}</code><a className="pv-inline-link" href={`/auditoria/${data.id}`}>Conferir documentação de auditoria ↗</a>{data.trustAnchors&&<><p className="pv-muted">Chave de lacração confiada:</p><code className="pv-fingerprint">{data.trustAnchors.sealKeyFingerprint}</code><p className="pv-muted">Comissão confiada:</p><code className="pv-fingerprint">{data.trustAnchors.rosterFingerprint}</code></>}</section>
    {data.governance&&<section className="pv-card"><p className="pv-overline">REGULAMENTO</p><h2>Quórum e critérios</h2><p>{!data.governance.configured?'Lista de eleitores aptos não configurada':data.governance.achieved?'Quórum mínimo atingido':'Quórum mínimo não atingido'}</p><p className="pv-muted">Exigência: {data.governance.minimumPercent}% · mínimo: {format(data.governance.required)} participantes.</p>{data.governance.tie&&<p className="pv-amber">Empate na maior votação. A comissão deverá aplicar o regulamento.</p>}</section>}
   </aside>
  </div>
  <div className="pv-warning"><strong>Limite da verificação:</strong> {data.warning}</div>
 </>;
}
export default function PublicDashboard({electionId}){
 const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[lastChecked,setLastChecked]=useState(null),[screen,setScreen]=useState(false);
 const refresh=useCallback(async(signal)=>{
  try{
   const response=await fetch(`/api/painel/${electionId}`,{cache:'no-store',signal,headers:{Accept:'application/json'}});
   if(!response.ok)throw Error(response.status===503?'Não foi possível validar os documentos. A divulgação foi bloqueada.':`Falha ao consultar os dados (${response.status}).`);
   const payload=await response.json();
   if(signal?.aborted)return;
   setData(payload);setError('');setLastChecked(new Date());
  }catch(e){if(signal?.aborted)return;setData(null);setError(e?.message||'Conexão indisponível');}finally{if(!signal?.aborted)setLoading(false)}
 },[electionId]);
 useEffect(()=>{let controller=new AbortController();const request=()=>{controller.abort();controller=new AbortController();if(!document.hidden)refresh(controller.signal);};request();const interval=setInterval(request,30000);const visible=()=>{if(!document.hidden)request()};document.addEventListener('visibilitychange',visible);return()=>{clearInterval(interval);document.removeEventListener('visibilitychange',visible);controller.abort()};},[refresh]);
 const toggleScreen=async()=>{
  try{if(document.fullscreenElement){await document.exitFullscreen();setScreen(false)}else{await document.querySelector('.pv-root')?.requestFullscreen();setScreen(true)}}catch{setScreen(false);}
 };
 return <div className={`pv-root ${screen?'pv-display':''}`}>
  <div className="pv-shell">
   <div className="pv-toolbar pv-noprint"><span className="pv-logo"><span className="pv-logo-mark">◈</span> Vota<span>Livre</span> <em>APURAÇÃO</em></span><div className="pv-actions"><button type="button" className="pv-btn pv-muted-btn" onClick={toggleScreen} aria-label={screen?'Sair do modo telão':'Alternar para modo telão'}>{screen?'Sair do telão':'Modo telão'}</button><button type="button" className="pv-btn pv-muted-btn" onClick={()=>refresh()} disabled={loading}>Atualizar</button>{data?.status==='published'&&<><a className="pv-btn pv-muted-btn" href={`/api/painel/${electionId}/relatorio`}>Baixar CSV</a><button type="button" className="pv-btn pv-primary" onClick={()=>window.print()}>Imprimir / salvar PDF</button></>}</div></div>
   <div className="pv-hero"><div><span className="pv-kicker">ELEIÇÃO INSTITUCIONAL • DIVULGAÇÃO</span><h1>{data?.title||'Central de apuração'}</h1><p>{data?.organization||'VotaLivre • Transparência e participação'}</p></div><span className={`pv-status ${data?.status==='published'?'pv-status-approved':''}`}>{data?statusName[data.status]||'Em verificação':'Carregando dados'}</span></div>
   {error&&<div role="alert" className="pv-warning pv-danger"><strong>Atualização não concluída.</strong> {error} A publicação fica indisponível até uma nova validação.</div>}
   {loading&&!data?<div className="pv-empty" role="status">Consultando o andamento da eleição…</div>:data?.status==='published'?<Results data={data}/>:<div className="pv-empty"><div className="pv-empty-symbol" aria-hidden="true">◈</div><h2>{data?statusName[data.status]:'Ainda não há dados disponíveis'}</h2><p>{data?.message||'O painel será atualizado quando houver dados aprovados para publicação.'}</p><p className="pv-muted">O sigilo das escolhas é preservado durante a votação. Nenhum resultado parcial por candidato é publicado.</p></div>}
   <div className="pv-footer"><span>VotaLivre Secure 1.0 RC • Homologação</span><span aria-live="off">Atualização automática a cada 30 s · Última consulta: {lastChecked?lastChecked.toLocaleTimeString('pt-BR'):'—'}</span></div>
  </div>
 </div>;
}
