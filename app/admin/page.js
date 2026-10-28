import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {db} from '@/lib/db';
import {adminContext} from '@/lib/security';
import AdminPanel from '@/components/AdminPanel';
import InstitutionPanel from '@/components/InstitutionPanel';
export const dynamic='force-dynamic';
export default async function Admin(){
 const jar=await cookies(),admin=await adminContext(jar.get('admin_session')?.value);
 if(!admin)redirect('/admin/login');
 const elections=await db()`SELECT e.id,e.organization_name,e.title,e.starts_at,e.ends_at,e.election_type,e.quorum_percent,e.tie_rule,
   (SELECT COUNT(*)::int FROM eligible_voters WHERE election_id=e.id) AS eligible,
   (SELECT COUNT(*)::int FROM voter_tokens WHERE election_id=e.id AND revoked_at IS NULL) AS issued,
   (SELECT COUNT(*)::int FROM voter_tokens WHERE election_id=e.id AND used_at IS NOT NULL) AS used
   FROM elections e WHERE e.organization_id=${admin.organization_id} ORDER BY e.created_at DESC LIMIT 100`;
 const batches=await db()`SELECT b.id,b.election_id,b.quantity,b.created_at,b.created_by,b.delivered_at,b.revoked_at,
 u.email AS issuer_email, e.title AS election_title
 FROM issue_batches b JOIN elections e ON e.id=b.election_id JOIN admin_users u ON u.id=b.created_by
 WHERE e.organization_id=${admin.organization_id} AND e.starts_at>NOW() AND b.revoked_at IS NULL
 ORDER BY b.created_at DESC LIMIT 100`;
 const [organization]=await db()`SELECT id,name,organization_type FROM organizations WHERE id=${admin.organization_id}`;
 const users=admin.role==='owner'?await db()`SELECT id,email,role,active FROM admin_users WHERE organization_id=${admin.organization_id} ORDER BY created_at` : [];
 const activities=await db()`SELECT action,detail,created_at FROM admin_activity WHERE organization_id=${admin.organization_id} ORDER BY created_at DESC LIMIT 12`;
 return <><InstitutionPanel organization={organization} admin={{id:admin.id,role:admin.role}} users={users} activities={activities.map(x=>({...x,created_at:x.created_at.toISOString()}))}/><AdminPanel admin={{id:admin.id,email:admin.email,role:admin.role}} batches={batches.map(b=>({...b,created_at:b.created_at.toISOString(),delivered_at:b.delivered_at?.toISOString()||null}))} elections={elections.map(e=>({...e,starts_at:e.starts_at.toISOString(),ends_at:e.ends_at.toISOString()}))}/></>;
}
