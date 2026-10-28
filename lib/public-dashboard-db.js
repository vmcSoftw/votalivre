/** Restricted public reads: never queries voter data or ballots for the public panel. */
import {db} from './db.js';
import {publicDashboard} from './public-dashboard.js';
export async function fetchPublicDashboard(id){
 const sql=db();
 const [e]=await sql`SELECT id,title,organization_name,starts_at,ends_at FROM elections WHERE id=${id}`;
 if(!e)return null;
 if(new Date(e.ends_at).getTime()>Date.now())return publicDashboard({election:e});
 const [snap]=await sql`SELECT manifest_text,signature_base64url,public_key_pem FROM audit_snapshots WHERE election_id=${id}`;
 if(!snap)return publicDashboard({election:e});
 const [cert]=await sql`SELECT certificate_text,published_at FROM committee_certificates WHERE election_id=${id}`;
 return publicDashboard({election:e,snapshot:snap,certificate:cert});
}
