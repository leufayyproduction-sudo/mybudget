import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import {createClient} from '@supabase/supabase-js';
for(const p of ['.env.local','.env.rls-test'])if(existsSync(p))loadEnvFile(p);
const report={checked_at:new Date().toISOString(),status:'running',checks:[],pending:['Premium positive and expiry HTTP require test plan fixture','duplicate positive/negative SQL fixture','live RLS catalog/private bucket flags','visual not run']};
const base=process.env.RLS_TEST_APP_URL||'http://127.0.0.1:3001',clients=[],users=[];
const check=(name,ok)=>{report.checks.push({name,passed:!!ok});if(!ok)throw new Error(name);};
async function http(path,token,options={}){return fetch(base+path,{...options,redirect:'manual',signal:AbortSignal.timeout(15000),headers:{...(token?{Authorization:`Bearer ${token}`}:{}) ,...options.headers}});}
try{
 const u=new URL(base);if(u.protocol!=='http:'||!['127.0.0.1','localhost'].includes(u.hostname))throw new Error('Localhost required');
 const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'';let allowed=key.startsWith('sb_publishable_');try{allowed ||= JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role==='anon';}catch{}
 if(!allowed||process.env.RLS_TEST_ALLOW_FIXTURES!=='dedicated-test-accounts')throw new Error('Public key/dedicated accounts required');
 check('anonymous CSV denied',(await http('/api/exports/transactions')).status===401);
 check('invalid JWT CSV denied',(await http('/api/exports/transactions','invalid-jwt')).status===401);
 check('admin without cookie redirects',(await http('/admin')).status===307);
 check('forged admin cookie redirects',(await http('/admin',null,{headers:{Cookie:'mybudget_admin_session=invalid-jwt'}})).status===307);
 const endpoints=['purchases','settings','content','proof','assets','session'];
 for(const name of endpoints){const method=['assets','session'].includes(name)?'POST':'GET';const r=await http('/api/admin/'+name,null,{method,headers:{Origin:base,'Content-Type':'application/json'},...(method==='POST'?{body:'{}'}:{})});check(`anonymous admin ${name}`,r.status===401||(name==='session'&&r.status===403));}
 for(const letter of ['A','B']){
  const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}});clients.push(c);
  const login=await c.auth.signInWithPassword({email:process.env[`RLS_TEST_${letter}_EMAIL`]||'',password:process.env[`RLS_TEST_${letter}_PASSWORD`]||''});if(login.error)throw new Error('Test login failed');users.push(login.data.user.id);
  const token=login.data.session.access_token;const [plan,role]=await Promise.all([c.rpc('get_entitlement'),c.rpc('is_admin')]);if(plan.error||role.error)throw new Error('Resolvers unavailable');
  const csv=await http('/api/exports/transactions?user_id=00000000-0000-0000-0000-000000000000',token);check(`${letter} actual CSV gate`,csv.status===(['plus','pro'].includes(plan.data.plan)?200:403));check(`${letter} CSV no-store`,csv.headers.get('cache-control')?.includes('no-store'));
  if(role.data){const rows=await c.rpc('admin_list_orders');check('admin list permitted',!rows.error);check('duplicate flag boolean schema',Array.isArray(rows.data)&&rows.data.every(r=>typeof r.duplicate_reference==='boolean'));report.duplicate_rows_checked=rows.data.length;
   for(const path of ['/admin','/admin/settings','/admin/content','/admin/content/preview']){const r=await http(path,token,{headers:{Cookie:`mybudget_admin_session=${token}`}});check(`admin page ${path}`,r.status===200);}
  }
  else{
   for(const name of endpoints){const method=['assets','session'].includes(name)?'POST':'GET';const r=await http('/api/admin/'+name,token,{method,headers:{Origin:base,'Content-Type':'application/json'},...(method==='POST'?{body:'{}'}:{})});check(`non-admin ${name}`,r.status===403);}
   for(const name of ['purchases','settings','content']){const r=await http('/api/admin/'+name,token,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});check(`non-admin write ${name}`,r.status===403);}
   for(const path of ['/admin','/admin/settings','/admin/content','/admin/content/preview']){const r=await http(path,token,{headers:{Cookie:`mybudget_admin_session=${token}`}});check(`non-admin page ${path}`,r.status===403);}
   for(const rpc of ['admin_purchase_summary','admin_list_orders']){const r=await c.rpc(rpc);check(`non-admin RPC ${rpc}`,r.error?.code==='42501');}
  }
 }
 check('distinct test users',users[0]!==users[1]);
 writeFileSync('.rls-release-phase2-test.sql',readFileSync('supabase/tests/release_phase2.sql','utf8').replaceAll('__USER_A__',users[0]).replaceAll('__USER_B__',users[1]));
 report.status='passed_selected_checks_owner_sql_pending';console.log(`PASS: ${report.checks.length} release checks; owner SQL/positive Premium pending.`);
}catch(e){report.status='failed_or_blocked';report.reason=e.message;console.log(`FAIL/BLOCKED: ${e.message}`);process.exitCode=1;}
finally{for(const c of clients)await c.auth.signOut({scope:'local'});writeFileSync('docs/release-phase2-result.json',JSON.stringify(report,null,2)+'\n');}
