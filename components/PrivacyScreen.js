'use client';
import {useEffect,useState} from 'react';
export default function PrivacyScreen({children}){
 const [covered,setCovered]=useState(false);
 useEffect(()=>{
  const conceal=()=>setCovered(true);
  const visibility=()=>{if(document.hidden)conceal()};
  const shortcuts=e=>{
   if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='p'){e.preventDefault();conceal();}
   if(e.key==='PrintScreen')conceal();
  };
  window.addEventListener('blur',conceal);
  document.addEventListener('visibilitychange',visibility);
  document.addEventListener('keydown',shortcuts);
  window.addEventListener('beforeprint',conceal);
  return()=>{window.removeEventListener('blur',conceal);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('keydown',shortcuts);window.removeEventListener('beforeprint',conceal)};
 },[]);
 return <div className={`private-voting-area ${covered?'private-covered':''}`}>
  <div className="protected-content" aria-hidden={covered}>{children}</div>
  {covered&&<div className="privacy-curtain" role="dialog" aria-modal="true" aria-label="Tela de privacidade">
   <div className="privacy-mark">◈</div><h2>Tela protegida</h2><p>Ocultamos a cédula quando a janela perdeu o foco. Verifique se está em um local reservado.</p><button type="button" className="btn" onClick={()=>setCovered(false)}>Revelar votação</button>
  </div>}
 </div>;
}
