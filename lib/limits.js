import {hashSource,trustedSource} from './issuance.js';
import {PublicError} from './security.js';

// Janela atômica persistida em PostgreSQL, compartilhada entre réplicas.
// O incremento ocorre antes da consulta ao token: IDs aleatórios não
// geram linhas arbitrárias na tabela de autenticação de credenciais.
export async function limitPublicVote(sql,request,electionId){
 return limitEndpoint(sql,request,`vote:${electionId}`,300);
}
export async function limitAdminLogin(sql,request){
 return limitEndpoint(sql,request,'admin-login',100);
}
export async function limitAdminRegistration(sql,request){
 return limitEndpoint(sql,request,'admin-registration',12);
}
async function limitEndpoint(sql,request,scope,max){
 const source=hashSource(trustedSource(request));
 const key=hashSource(`${scope}:${source}`);
 const [bucket]=await sql`
 INSERT INTO request_rate_limits(bucket_key,window_start,attempts)
 VALUES(${key},NOW(),1)
 ON CONFLICT(bucket_key) DO UPDATE SET
  attempts=CASE WHEN request_rate_limits.window_start<NOW()-INTERVAL '5 minutes' THEN 1 ELSE request_rate_limits.attempts+1 END,
  window_start=CASE WHEN request_rate_limits.window_start<NOW()-INTERVAL '5 minutes' THEN NOW() ELSE request_rate_limits.window_start END
 RETURNING attempts`;
 // Limite inicial conservador: 300 submissões por 5 minutos por origem
 // para uma eleição; calibrar com ensaios de carga antes de uso real.
 if(bucket.attempts>max)throw new PublicError('Muitas tentativas. Aguarde e tente novamente.',429);
}
