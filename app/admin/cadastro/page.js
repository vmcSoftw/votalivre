'use client';
import {useState} from 'react';

export default function Cadastro(){
 const [organization,setOrganization]=useState('');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [confirmPassword,setConfirmPassword]=useState('');
 const [invitation,setInvitation]=useState('');
 const [step,setStep]=useState(null);
 const [code,setCode]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [done,setDone]=useState(null);
 async function register(e){
  e.preventDefault();setError('');
  if(password!==confirmPassword){setError('As senhas não coincidem.');return}
  setBusy(true);
  try{
   const res=await fetch('/api/admin/register',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({organization,email,password,invitation})});
   const data=await res.json();if(!res.ok)throw Error(data.error||'Falha ao criar conta.');
   setStep(data);setPassword('');setConfirmPassword('');setInvitation('');
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function confirm(e){
  e.preventDefault();setBusy(true);setError('');
  try{
   const res=await fetch('/api/admin/register/confirm',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({setupToken:step.setupToken,code})});
   const data=await res.json();if(!res.ok)throw Error(data.error||'Não foi possível ativar.');
   setDone(data);setStep(null);setCode('');
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 const loginHref=done?`/admin/login?organizationId=${encodeURIComponent(done.organizationId)}&email=${encodeURIComponent(done.email)}`:'/admin/login';
 return <div className="narrow auth-screen"><div className="panel auth-panel">
  <div className="mini-symbol" aria-hidden="true">✳</div>
  <div className="eyebrow">VOTALIVRE • CADASTRO INSTITUCIONAL</div>
  {done ? <>
    <h1>Conta ativada.</h1>
    <div className="success-note" role="status">A verificação em duas etapas foi concluída. Aguarde o próximo código do autenticador para entrar no painel.</div>
    <p><strong>Identificador da organização:</strong></p><div className="receipt">{done.organizationId}</div>
    <p className="muted">Guarde este identificador. Ele será solicitado juntamente com seu e-mail, senha e código MFA.</p>
    <a className="btn full" href={loginHref}>Ir para o acesso administrativo →</a>
  </> : step ? <>
    <h1>Proteja seu acesso.</h1>
    <p className="muted">Para ativar sua conta, configure o aplicativo autenticador, como Google Authenticator ou Microsoft Authenticator.</p>
    <div className="notice"><strong>1.</strong> Abra o autenticador e escolha adicionar uma conta por chave de configuração.<p className="small">Selecione <strong>chave baseada em tempo (TOTP)</strong>.</p></div>
    <p><strong>Chave de configuração (mostrada somente nesta etapa):</strong></p>
    <div className="receipt key-display">{step.totpSecret}</div>
    <button type="button" className="btn outline" onClick={()=>navigator.clipboard?.writeText(step.totpSecret)}>Copiar chave</button>
    <p><strong>2.</strong> Digite o código de seis dígitos mostrado no seu autenticador.</p>
    <form className="stack" onSubmit={confirm}><label>Código MFA<input required autoFocus type="text" inputMode="numeric" autoComplete="one-time-code" maxLength="6" pattern="[0-9]{6}" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000000"/></label>
    {error&&<div role="alert" className="error">{error}</div>}
    <button className="btn full" disabled={busy}>{busy?'Verificando...':'Ativar minha conta →'}</button></form>
    <p className="muted small">A ativação expira em 15 minutos. Não feche esta página antes de confirmar.</p>
  </> : <>
    <h1>Crie sua conta.</h1>
    <p className="muted">Cadastre uma organização para administrar suas próprias eleições. É necessário um convite individual de uso único, fornecido pelo operador do sistema.</p>
    <form className="stack" onSubmit={register}>
      <label>Nome da escola, empresa ou associação<input required maxLength="120" minLength="2" value={organization} onChange={e=>setOrganization(e.target.value)} placeholder="Ex.: Escola Estadual Modelo" autoComplete="organization"/></label>
      <label>E-mail do responsável<input type="email" required maxLength="254" value={email} onChange={e=>setEmail(e.target.value)} placeholder="gestor@instituicao.com.br" autoComplete="email"/></label>
      <div className="two"><label>Crie uma senha<input required minLength="16" maxLength="1024" type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 16 caracteres"/></label>
      <label>Confirme a senha<input required minLength="16" type="password" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Repita sua senha"/></label></div>
      <label>Código de convite<input required minLength="64" maxLength="64" pattern="[a-fA-F0-9]{64}" autoComplete="off" value={invitation} onChange={e=>setInvitation(e.target.value)} placeholder="64 caracteres enviados pelo operador"/></label>
      {error&&<div role="alert" className="error">{error}</div>}
      <button className="btn full" disabled={busy}>{busy?'Criando conta...':'Criar conta e configurar MFA →'}</button>
    </form>
    <p className="muted small">O cadastro exige aprovação por convite. Para uma nova conta de uma organização existente, solicite a inclusão ao gestor.</p>
  </>}
  <a className="text-link" href="/admin/login">← Voltar ao login</a>
 </div></div>;
}
