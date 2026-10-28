import {db} from '../lib/db.js';
const electionId=process.argv[2];
if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(electionId||'')){
 throw Error('Uso: npm run election:preflight -- UUID_DA_ELEICAO');
}
const sql=db();
try{
 const [e]=await sql`SELECT id,title,starts_at,ends_at,quorum_percent FROM elections WHERE id=${electionId}`;
 if(!e)throw Error('Eleição não encontrada');
 const [counts]=await sql`SELECT COUNT(*)::int AS issued, COUNT(*) FILTER (WHERE used_at IS NOT NULL)::int AS used FROM voter_tokens WHERE election_id=${electionId}`;
 const [ballots]=await sql`SELECT COUNT(*)::int AS count FROM ballots WHERE election_id=${electionId}`;
 const [receipts]=await sql`SELECT COUNT(*)::int AS count FROM ballot_receipts WHERE election_id=${electionId}`;
 const options=await sql`SELECT kind,COUNT(*)::int AS quantity FROM ballot_options WHERE election_id=${electionId} GROUP BY kind`;
 const [roster]=await sql`SELECT COUNT(*)::int AS eligible FROM eligible_voters WHERE election_id=${electionId}`;
 const [snap]=await sql`SELECT EXISTS(SELECT 1 FROM audit_snapshots WHERE election_id=${electionId}) AS sealed`;
 const warnings=[],errors=[],now=Date.now(),started=e.starts_at.getTime()<=now,finished=e.ends_at.getTime()<=now;
 const byKind=Object.fromEntries(options.map(o=>[o.kind,o.quantity]));
 if((byKind.candidate||0)<2)errors.push('Menos de 2 opções de candidatos/chapas');
 if(byKind.blank!==1||byKind.null!==1)errors.push('Cédula sem opções únicas de branco e nulo');
 if(counts.used!==ballots.count||ballots.count!==receipts.count)errors.push('Divergência crítica entre votos, recibos e credenciais usadas');
 if(roster.eligible>0&&counts.issued>roster.eligible)errors.push('Credenciais emitidas superam lista de aptos');
 if(e.quorum_percent>0&&roster.eligible===0)errors.push('Quórum configurado sem base de eleitores aptos');
 if(counts.used>counts.issued)errors.push('Credenciais utilizadas superam emitidas');
 if(started&&!finished&&!counts.issued)warnings.push('Eleição em andamento sem credenciais emitidas');
 if(!started&&counts.used)errors.push('Votos computados antes da abertura');
 if(!finished&&snap.sealed)errors.push('Manifesto lacrado antes do encerramento');
 if(finished&&!snap.sealed)warnings.push('Eleição encerrada sem manifesto assinado');
 if(counts.issued===0)warnings.push('Nenhum participante habilitado por credencial');
 console.log(JSON.stringify({schema:'votalivre-preflight-v1',electionId,title:e.title,state:!started?'programada':finished?'encerrada':'em_votacao',issued:counts.issued,eligible:roster.eligible,used:counts.used,ballots:ballots.count,receipts:receipts.count,sealed:snap.sealed,optionKinds:byKind,errors,warnings,mathCheck:errors.length===0},null,2));
 if(errors.length)process.exitCode=2;
}finally{await sql.end();}
