'use client';
import {useState} from 'react';
// Parser de CSV sem dependências. Respeita aspas duplas, CRLF e ponto e vírgula.
function parseCsv(input){
 const rows=[];let row=[],cell='',quoted=false;
 const str=input.replace(/^\uFEFF/,'');
 for(let i=0;i<str.length;i++){
  const c=str[i];
  if(c==='"'){if(quoted&&str[i+1]==='"'){cell+='"';i++}else quoted=!quoted;continue}
  if(!quoted&&(c===';'||c==='\n'||c==='\r')){
   row.push(cell.trim());cell='';
   if(c==='\n'||c==='\r'){if(row.some(x=>x))rows.push(row);row=[];if(c==='\r'&&str[i+1]==='\n')i++}
  }else cell+=c;
 }
 if(quoted)throw Error('CSV contém aspas abertas');
 row.push(cell.trim());if(row.some(x=>x))rows.push(row);
 if(!rows.length)throw Error('Arquivo CSV vazio');
 const header=rows.shift().map(x=>x.toLowerCase());
 if(header[0]!=='identificador'||header[1]!=='nome'||header.length!==2)throw Error('O CSV deve ter cabeçalho: identificador;nome');
 return rows.map((r,i)=>{if(r.length!==2)throw Error(`Linha ${i+2}: são necessárias duas colunas`);return {identifier:r[0],name:r[1]}});
}
export default function VoterRoster({electionId,eligible,issued,adminRole,status}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[count,setCount]=useState(eligible);
 const [visible,setVisible]=useState(false),[voters,setVoters]=useState([]);
 const enabled=status==='Programada'&&issued===0&&adminRole!=='auditor';
 async function load(){try{const r=await fetch(`/api/admin/elections/${electionId}/roster`,{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error);setVoters(d.entries||[]);setVisible(true)}catch(e){setMessage(e.message)}}
 async function importFile(e){const file=e.target.files?.[0];if(!file)return;setBusy(true);setMessage('');try{
  if(file.size>1500000)throw Error('Arquivo muito grande. Divida em lotes menores.');
  const entries=parseCsv(await file.text());if(entries.length===0||entries.length+count>10000)throw Error('Lista vazia ou acima do limite de 10.000 aptos.');
  let imported=0;
  for(let i=0;i<entries.length;i+=200){
   const r=await fetch(`/api/admin/elections/${electionId}/roster`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({entries:entries.slice(i,i+200)})});const d=await r.json();
   if(!r.ok)throw Error(`Após ${imported} importados: ${d.error}`);imported+=d.imported;setCount(d.total);
  }
  setMessage(`${imported} eleitores aptos cadastrados. A lista será congelada na emissão da primeira credencial.`);setVisible(false);
 }catch(error){setMessage(error.message)}finally{setBusy(false);e.target.value=''}}
 return <details className="roster-section"><summary>Cadastro de eleitores aptos <span className="muted small">({count} cadastrados)</span></summary><p className="muted small">Importe somente participantes autorizados, com arquivo <code>.csv</code> contendo <code>identificador;nome</code>. Os nomes são cifrados e os identificadores protegidos por HMAC. A lista não se vincula aos votos.</p>
 {enabled?<label className="upload-box">Importar arquivo CSV (até 10.000 aptos)<input type="file" accept=".csv,text/csv" onChange={importFile} disabled={busy}/></label>:<p className="muted small">Cadastro em modo leitura: votos ou credenciais já iniciaram o ciclo eleitoral, ou sua conta é somente fiscal.</p>}
 {adminRole!=='auditor'&&<button type="button" className="mini" onClick={load}>Consultar primeiros 40 nomes</button>}
 {visible&&<div className="roster-list"><ul>{voters.map(v=><li key={v.reference}>{v.name} <span className="muted small">{v.reference}…</span></li>)}</ul>{count>40&&<p className="muted small">Exibindo os primeiros 40 por referência pseudônima.</p>}</div>}
 {busy&&<p role="status">Importando e verificando registros…</p>}{message&&<p role="status" className="muted small">{message}</p>}
 </details>;
}
