/**
 * Executar SOMENTE em banco exclusivamente de homologação com schema.sql aplicado.
 * Nunca executa em DATABASE_URL de produção: exige TEST_DATABASE_URL e opt-in explícito.
 */
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import postgres from 'postgres';
import {makeToken,makeReceipt,makeVoterPin,tokenDigest,voterPinDigest,sha256,encryptChoice} from '../lib/crypto.js';
import {encryptPinBatch} from '../lib/issuance.js';

if(process.env.VOTALIVRE_HOMOLOGATION!=='YES'||!process.env.TEST_DATABASE_URL) {
  throw Error('Exige VOTALIVRE_HOMOLOGATION=YES e TEST_DATABASE_URL de banco de testes isolado.');
}
if(process.env.DATABASE_URL && process.env.DATABASE_URL===process.env.TEST_DATABASE_URL) {
  throw Error('TEST_DATABASE_URL deve ser diferente da DATABASE_URL regular.');
}
for(const name of ['TOKEN_PEPPER','VOTER_PIN_PEPPER','BALLOT_ENCRYPTION_KEY','ISSUANCE_ENCRYPTION_KEY']){
  process.env[name]=randomBytes(32).toString('hex'); // Nunca utilizar chaves reais na homologação.
}
const url=process.env.TEST_DATABASE_URL;
const local=/localhost|127\.0\.0\.1/.test(url);
const sql=postgres(url,{max:20,ssl:local?false:'require',prepare:false,connect_timeout:12});
const report={schema:'votalivre-db-homologacao-v06',date:new Date().toISOString(),result:'pending'};
let qaAdminId;
async function issue(electionId){
  const token=makeToken(),pin=makeVoterPin(),batch=randomUUID();
  await sql.begin(async tx=>{
    await tx`INSERT INTO issue_batches(id,election_id,created_by,pins_ciphertext,quantity)
             VALUES(${batch},${electionId},${qaAdminId},${encryptPinBatch(batch,electionId,[pin])},1)`;
    await tx`INSERT INTO voter_tokens(election_id,issue_batch_id,token_hash,pin_hash)
             VALUES(${electionId},${batch},${tokenDigest(token)},${voterPinDigest(electionId,token,pin)})`;
  });
  return {token,pin};
}
async function cast(electionId,optionId,{token,pin},{injectFailure=false}={}){
  return sql.begin(async tx=>{
    const [e]=await tx`SELECT id FROM elections WHERE id=${electionId} AND starts_at<=NOW() AND ends_at>NOW() FOR SHARE`;
    if(!e)return false;
    const [o]=await tx`SELECT id FROM ballot_options WHERE id=${optionId} AND election_id=${electionId}`;
    if(!o)return false;
    const [claimed]=await tx`UPDATE voter_tokens SET used_at=NOW() WHERE election_id=${electionId} AND token_hash=${tokenDigest(token)} AND pin_hash=${voterPinDigest(electionId,token,pin)} AND used_at IS NULL AND revoked_at IS NULL RETURNING id`;
    if(!claimed)return false;
    if(injectFailure)throw Error('FALHA SIMULADA - ROLLBACK');
    await tx`INSERT INTO ballots(election_id,encrypted_choice) VALUES(${electionId},${encryptChoice(electionId,optionId)})`;
    await tx`INSERT INTO ballot_receipts(election_id,receipt_hash) VALUES(${electionId},${sha256(makeReceipt())})`;
    return true;
  });
}
try{
  const required=['organizations','issue_batches','request_rate_limits','elections','ballot_options','voter_tokens','ballots','ballot_receipts','audit_snapshots'];
  for(const table of required){
    const [r]=await sql`SELECT to_regclass(${`public.${table}`}) IS NOT NULL AS present`;
    assert(r.present,`Tabela ausente: ${table}. Aplique sql/schema.sql no banco EXCLUSIVO de testes.`);
  }
  const name=`QA FICTICIA ${randomBytes(5).toString('hex')}`;
  const [org]=await sql`INSERT INTO organizations(name) VALUES(${name}) RETURNING id`;
  const [qaAdmin]=await sql`INSERT INTO admin_users(organization_id,email,password_hash,totp_secret,role)
                 VALUES(${org.id},${`qa-${randomUUID()}@example.invalid`},'QA-PASSWORD-HASH-PLACEHOLDER','QA-ENCRYPTED-TOTP-PLACEHOLDER','owner') RETURNING id`;
  qaAdminId=qaAdmin.id;
  const [e1]=await sql`INSERT INTO elections(organization_id,organization_name,title,starts_at,ends_at) VALUES(${org.id},${name},'Eleicao A - simulacao',NOW()-INTERVAL '1 minute',NOW()+INTERVAL '1 hour') RETURNING id`;
  const [e2]=await sql`INSERT INTO elections(organization_id,organization_name,title,starts_at,ends_at) VALUES(${org.id},${name},'Eleicao B - simulacao',NOW()-INTERVAL '1 minute',NOW()+INTERVAL '1 hour') RETURNING id`;
  const [option]=await sql`INSERT INTO ballot_options(election_id,label,kind,position) VALUES(${e1.id},'Chapa Ficticia A','candidate',1) RETURNING id`;
  const [otherOption]=await sql`INSERT INTO ballot_options(election_id,label,kind,position) VALUES(${e2.id},'Chapa Ficticia B','candidate',1) RETURNING id`;
  const credential=await issue(e1.id);
  const parallel=await Promise.all(Array.from({length:30},()=>cast(e1.id,option.id,credential)));
  assert.equal(parallel.filter(Boolean).length,1,'A mesma credencial não pode produzir 2 votos');
  report.sameCredentialAttempts=30;report.sameCredentialAccepted=1;
  const others=await Promise.all(Array.from({length:40},()=>issue(e1.id)));
  const accepted=await Promise.all(others.map(c=>cast(e1.id,option.id,c)));
  assert(accepted.every(Boolean),'Cada credencial distinta deve produzir um voto');
  report.uniqueVoters=40;
  const replays=await Promise.all(others.map(c=>cast(e1.id,option.id,c)));
  assert(replays.every(x=>x===false),'Repetição de credencial não pode produzir novo voto');
  report.duplicateVotesAccepted=0;
  const rollbackToken=await issue(e1.id);
  await assert.rejects(cast(e1.id,option.id,rollbackToken,{injectFailure:true}),/ROLLBACK/);
  const [rollbackState]=await sql`SELECT used_at IS NULL AS available FROM voter_tokens WHERE election_id=${e1.id} AND token_hash=${tokenDigest(rollbackToken.token)}`;
  assert.equal(rollbackState.available,true,'Falha após consumo deve desfazer a transação');
  report.rollbackPassed=true;
  const wrongElectionToken=await issue(e2.id);
  assert.equal(await cast(e1.id,option.id,wrongElectionToken),false,'Token de outra eleição deve ser recusado');
  assert.equal(await cast(e2.id,option.id,wrongElectionToken),false,'Opção de outra eleição deve ser recusada');
  assert.equal(await cast(e2.id,otherOption.id,wrongElectionToken),true);
  report.crossElectionIsolation=true;
  const [cnt]=await sql`SELECT (SELECT COUNT(*)::int FROM voter_tokens WHERE election_id=${e1.id} AND used_at IS NOT NULL) AS used, (SELECT COUNT(*)::int FROM ballots WHERE election_id=${e1.id}) AS ballots, (SELECT COUNT(*)::int FROM ballot_receipts WHERE election_id=${e1.id}) AS receipts`;
  assert.deepEqual([cnt.used,cnt.ballots,cnt.receipts],[41,41,41]);
  report.reconciledCounts=cnt;
  report.result='passed';
} catch(e){report.result='failed';report.error=e.message;process.exitCode=1;}
finally{console.log(JSON.stringify(report,null,2));await sql.end();}
