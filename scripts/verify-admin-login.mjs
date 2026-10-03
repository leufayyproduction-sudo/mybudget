import {existsSync,writeFileSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
for(const p of ['.env.local','.env.rls-test'])if(existsSync(p))loadEnvFile(p);
const base=process.env.RLS_TEST_APP_URL||'http://127.0.0.1:3001';
const report={checked_at:new Date().toISOString(),status:'running',checks:[],pending:[]};
const check=(name,ok)=>{report.checks.push({name,passed:!!ok});if(!ok)throw new Error(name);};
const request=(path,options={})=>fetch(base+path,{...options,redirect:'manual',signal:AbortSignal.timeout(30000)});
async function login(email,password){return request('/api/admin/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email,password})});}
try{
 const u=new URL(base);if(u.protocol!=='http:'||!['localhost','127.0.0.1'].includes(u.hostname))throw new Error('localhost only');
 check('login page public',(await request('/admin/login')).status===200);
 for(const path of ['/admin','/admin/settings','/admin/content','/admin/content/preview','/admin/connect','/api/admin/purchases','/api/admin/settings','/api/admin/content','/api/admin/proof']){
  const r=await request(path);check(`${path} redirects without session`,r.status===307&&new URL(r.headers.get('location'),base).pathname==='/admin/login');
 }
 const invalid=await request('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});check('missing origin denied',invalid.status===403);
 if(process.env.RLS_TEST_ALLOW_FIXTURES!=='dedicated-test-accounts')throw new Error('Dedicated accounts required');
 const ordinary=await login(process.env.RLS_TEST_A_EMAIL,process.env.RLS_TEST_A_PASSWORD);const first=await ordinary.json();
 if(ordinary.status===503){report.pending.push('Apply migration 014; login, real audit/role/rate-limit pending');report.status='passed_public_guards_configuration_pending';}
 else if(ordinary.status===429){report.pending.push('Test identity rate limited; wait 15 minutes');report.status='passed_public_guards_rate_limited';}
 else{
  check('non-admin login denied',ordinary.status===401);
  check('non-admin has no admin cookie',ordinary.headers.getSetCookie().every(h=>h.includes('Max-Age=0')));
  const wrong=await login(process.env.RLS_TEST_A_EMAIL,'intentionally-wrong-admin-test-password');const second=await wrong.json();check('wrong password identical generic message',wrong.status===401&&first.error===second.error);
  const admin=await login(process.env.RLS_TEST_B_EMAIL,process.env.RLS_TEST_B_PASSWORD);check('admin login accepted',admin.status===200);
  const headers=admin.headers.getSetCookie();const active=headers.find(h=>h.startsWith('mybudget_admin_session=')&&!h.includes('Max-Age=0'));
  check('admin cookie HttpOnly Strict',!!active&&active.includes('HttpOnly')&&active.includes('SameSite=Strict'));
  const cookie=active.split(';')[0];
  check('admin page with cookie',(await request('/admin',{headers:{Cookie:cookie}})).status===200);
  check('admin API with cookie only',(await request('/api/admin/purchases',{headers:{Cookie:cookie}})).status===200);
  const out=await request('/api/admin/session',{method:'DELETE',headers:{Cookie:cookie,Origin:base}});check('logout clears both cookie paths',out.status===200&&out.headers.getSetCookie().filter(h=>h.includes('Max-Age=0')).length===2);
  report.pending.push('SQL audit/rate-limit/role fixtures need owner rollback test; expiry/HTTPS/visual not run');report.status='passed_selected_live_checks';
 }
 console.log(`PASS: ${report.checks.length} admin login HTTP checks; ${report.pending.length} pending items.`);
}catch(e){report.status='failed_or_blocked';report.reason=e.message;console.log(`FAIL/BLOCKED: ${e.message}`);process.exitCode=1;}
finally{writeFileSync('docs/admin-login-result.json',JSON.stringify(report,null,2)+'\n');}
