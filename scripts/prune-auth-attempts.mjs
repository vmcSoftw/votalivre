import {db} from '../lib/db.js';
// Exclusivamente metadados de tentativas antigas. Nunca apagar votos, credenciais ou recibos.
const sql=db();
try{
 const [voter]=await sql`WITH deleted AS (DELETE FROM voter_auth_attempts WHERE window_start < NOW()-INTERVAL '2 hours' RETURNING token_hash) SELECT COUNT(*)::int AS amount FROM deleted`;
 const [admin]=await sql`WITH deleted AS (DELETE FROM auth_attempts WHERE window_start < NOW()-INTERVAL '24 hours' RETURNING identifier_hash) SELECT COUNT(*)::int AS amount FROM deleted`;
 const [source]=await sql`WITH deleted AS (DELETE FROM request_rate_limits WHERE window_start < NOW()-INTERVAL '2 hours' RETURNING bucket_key) SELECT COUNT(*)::int AS amount FROM deleted`;
 console.log(JSON.stringify({voterAttemptRowsPruned:voter.amount,adminAttemptRowsPruned:admin.amount,sourceBucketsPruned:source.amount}));
}finally{await sql.end();}
