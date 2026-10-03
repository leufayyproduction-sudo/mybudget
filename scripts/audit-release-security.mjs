// Reports locations/counts only. Never print matched secrets, even from history.
import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
const git=(...args)=>execFileSync('git',['-c','safe.directory=D:/website andita',...args],{encoding:'utf8',maxBuffer:128*1024*1024});
const report={checked_at:new Date().toISOString(),scope:'tracked and non-ignored untracked worktree, all reachable git blobs; migration source, not live database',secret_findings:[],tables_without_rls:[],routes:[],rpc_review:[],actions:[],private_buckets:[]};
function scan(text,location){
 const patterns=[['supabase_secret',/sb_secret_[A-Za-z0-9_-]{16,}/],['private_key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],['credential_assignment',/(?:SERVICE_ROLE_KEY|SECRET_KEY|PASSWORD|ACCESS_TOKEN)\s*[=:]\s*["']?(?!process\.|\$|<|placeholder|your_|undefined|null)[A-Za-z0-9_+\/-]{20,}/i]];
 for(const [kind,re] of patterns)if(re.test(text))report.secret_findings.push({location,kind});
 for(const match of text.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)){try{if(JSON.parse(Buffer.from(match[0].split('.')[1],'base64url')).role==='service_role')report.secret_findings.push({location,kind:'service_role_jwt'});}catch{}}
}
for(const path of [...git('ls-files').trim().split('\n'),...git('ls-files','--others','--exclude-standard').trim().split('\n')]){try{scan(readFileSync(path,'utf8'),path);}catch{}}
const objects=git('rev-list','--objects','--all').trim().split('\n');let blobs=0;
for(const row of objects){const space=row.indexOf(' '),id=space<0?row:row.slice(0,space);if(git('cat-file','-t',id).trim()!=='blob')continue;blobs++;scan(git('cat-file','-p',id),`git:${id.slice(0,12)}`);}
report.history_blobs=blobs;
const sql=readdirSync('supabase/migrations').filter(p=>p.endsWith('.sql')).map(p=>readFileSync('supabase/migrations/'+p,'utf8')).join('\n');
for(const match of sql.matchAll(/create table(?: if not exists)?\s+(?:public\.)?(\w+)/gi)){const name=match[1];if(!new RegExp(`alter table (?:public\\.)?${name} enable row level security`,'i').test(sql))report.tables_without_rls.push(name);}
for(const match of sql.matchAll(/create(?: or replace)? function public\.(\w+)[\s\S]*?\$\$([\s\S]*?)\$\$/gi)){const name=match[1],body=match[2];report.rpc_review.push({name,admin_guard:body.includes('is_admin()'),owner_guard:body.includes('auth.uid()'),entitlement_guard:/get_effective_plan|get_entitlement|can_use_tool|get_pro_analytics/.test(body),pure_helper:/valid_|recurring_next/.test(name)});}
function walk(path){for(const item of readdirSync(path,{withFileTypes:true})){const p=path+'/'+item.name;if(item.isDirectory())walk(p);else if(/\.[jt]sx?$/.test(p)){const s=readFileSync(p,'utf8');if(p.endsWith('/route.ts'))report.routes.push({path:p,verified_client:/authenticatedClient|adminClient/.test(s),admin:p.includes('/admin/')});if(/['"]use server['"]/.test(s))report.actions.push(p);}}}
walk('app');
report.private_buckets=['payment-proofs','digital-files'].map(name=>({name,declared_private:new RegExp(`'${name}'[^;]*?false`,'s').test(sql)}));
report.status=report.secret_findings.length||report.tables_without_rls.length?'review_required':'passed_static_checks_live_catalog_pending';
writeFileSync('docs/release-security-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(`Audit: ${blobs} history blobs, ${report.secret_findings.length} secret findings, ${report.tables_without_rls.length} tables without source RLS, ${report.routes.length} routes. Live catalog pending.`);
if(report.secret_findings.length||report.tables_without_rls.length)process.exitCode=1;
