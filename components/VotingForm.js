'use client';
import {useState} from 'react';
export default function VotingForm({electionId,options,startsAt,endsAt}){
 const [token,setToken]=useState(''),[pin,setPin]=useState(''),[choice,setChoice]=useState(''),[review,setReview]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[receipt,setReceipt]=useState('');
 const now=Date.now(),open=now>=Date.parse(startsAt)&&now<Date.parse(endsAt),selected=options.find(o=>o.id===choice);
 async function vote(){
  if(!review||!selected||!token||!/^[0-9]{10}$/.test(pin))return;
  setBusy(true);setError('');
  try{
   const r=await fetch('/api/vote',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({electionId,optionId:choice,token:token.trim(),pin})});
   const d=await r.json();if(!r.ok)throw Error(d.error);
   setToken('');setPin('');setChoice('');setReview(false);setReceipt(d.receipt);
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 if(receipt)return <div className="panel success"><div className="success-icon">✓</div><div className="eyebrow">CONFIRMAÇÃO CONCLUÍDA</div><h2>Voto registrado com sucesso</h2><p>Guarde este recibo para conferir a inclusão de um registro no manifesto assinado após a eleição. O recibo não revela nem comprova sua escolha.</p><div className="receipt">{receipt}</div><button className="btn" onClick={()=>navigator.clipboard?.writeText(receipt)}>Copiar código de inclusão</button><a className="text-link" href={`/conferir/${electionId}`}>Conferir inclusão do registro →</a><p className="muted small">Não compartilhe sua credencial. Não é necessário mostrar sua escolha a ninguém.</p></div>;
 return <div className="panel"><div className="vote-steps" aria-label="Etapas da votação"><span className={!review?'active':''}>1 · Escolha</span><span className={review?'active':''}>2 · Confirmação</span><span>3 · Recibo</span></div><div className="spread"><h2>{review?'Revise sua escolha':'Selecione sua escolha'}</h2><span className="status">{open?'Votação aberta':now<Date.parse(startsAt)?'Aguardando início':'Encerrada'}</span></div>
  <p className="muted small">Período: {new Date(startsAt).toLocaleString('pt-BR')} — {new Date(endsAt).toLocaleString('pt-BR')}</p>
  {!open?<p>A votação não está aberta neste momento. Consulte o período informado pela organização.</p>:review?
   <div className="stack"><div className="notice"><strong>Escolha selecionada:</strong> {selected?.label}. Após confirmar, não será possível alterar o voto. Verifique se está votando em ambiente reservado.</div>{error&&<div className="error" role="alert">{error}</div>}<button className="btn full" disabled={busy} onClick={vote}>{busy?'Registrando com segurança...':'Confirmar voto definitivamente →'}</button><button className="btn outline full" type="button" disabled={busy} onClick={()=>{setReview(false);setError('')}}>← Voltar e alterar</button></div>:
   <form onSubmit={e=>{e.preventDefault();setReview(true);setError('')}} className="stack">
    <label className="field-title">Sua opção</label><div className="ballot">{options.map(o=><label className={`choice ${choice===o.id?'selected':''}`} key={o.id}><input type="radio" name="choice" value={o.id} checked={choice===o.id} onChange={e=>setChoice(e.target.value)} required/><span>{o.label}</span>{o.kind!=='candidate'&&<span className="muted small">({o.kind==='blank'?'branco':'nulo'})</span>}</label>)}</div>
    <label>Credencial individual<input type="password" autoComplete="off" required minLength="30" value={token} onChange={e=>setToken(e.target.value)} placeholder="Cole seu código de votação"/></label>
    <label>Código de confirmação (10 dígitos)<input type="password" inputMode="numeric" autoComplete="off" required pattern="[0-9]{10}" minLength="10" maxLength="10" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="Código enviado separadamente"/></label>
    <p className="muted small">Use a credencial e o código de confirmação recebidos por canais separados. Nenhum deles identifica automaticamente a pessoa. Sua credencial será inutilizada após o voto. A escolha é criptografada no servidor e armazenada sem nome, CPF ou matrícula no registro do voto.</p>
    {error&&<div className="error" role="alert">{error}</div>}<button className="btn full" disabled={!choice}>Continuar e revisar voto →</button>
   </form>}
 </div>;
}
