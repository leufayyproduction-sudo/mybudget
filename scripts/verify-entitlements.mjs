import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { createClient } from '@supabase/supabase-js';
if(existsSync('.env.local')) loadEnvFile('.env.local');
if(existsSync('.env.rls-test')) loadEnvFile('.env.rls-test');
const result={checked_at:new Date().toISOString(),status:'blocked',checks:[],premium_sql_test:'pending',mutation:'none'};
const clients=[];
const check=(label,ok)=>{result.checks.push({label,passed:ok});if(!ok){result.status='failed';throw new Error(label);}console.log(`PASS ${label}`);};
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}};
try {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key) throw new Error('Environment Supabase belum lengkap.');
 let publicKey=key.startsWith('sb_publishable_');
 try{publicKey ||= JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon';}catch{}
 if(!publicKey) throw new Error('Hanya anon/publishable key diizinkan.');
 if(process.env.RLS_TEST_ALLOW_FIXTURES!=='dedicated-test-accounts') throw new Error('Gunakan dua akun khusus di .env.rls-test.');
 for(const letter of ['A','B']){
  const c=createClient(url,key,options);clients.push(c);
  const r=await c.auth.signInWithPassword({email:process.env[`RLS_TEST_${letter}_EMAIL`]||'',password:process.env[`RLS_TEST_${letter}_PASSWORD`]||''});
  if(r.error||!r.data.user) throw new Error(`Login akun ${letter} gagal; cek file lokal/konfirmasi email.`);
  c.testUserId=r.data.user.id;
 }
 check('Dua pengguna berbeda',clients[0].testUserId!==clients[1].testUserId);
 const template=readFileSync('supabase/tests/plans_entitlements.sql','utf8');
 writeFileSync('.rls-entitlements-test.sql',template.replaceAll('__USER_A__',clients[0].testUserId).replaceAll('__USER_B__',clients[1].testUserId));
 console.log('SQL rollback lengkap disiapkan: .rls-entitlements-test.sql (diabaikan git).');
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit'}).formatToParts(new Date());
 const month=`${date.find(p=>p.type==='year').value}-${date.find(p=>p.type==='month').value}`;
 for(const [i,c] of clients.entries()){
  const e=await c.rpc('get_entitlement');
  if(e.error) throw new Error('RPC paket belum tersedia. Jalankan migration 004 terlebih dulu.');
  check('Akun uji Free tidak mendapat reports_access',e.data.plan==='free'&&e.data.reports_access===false);
  const report=await c.rpc('get_report_transactions',{p_month:month});
  check('Free ditolak oleh RPC laporan',report.error?.code==='42501');
  const b=clients[1-i].testUserId;
  const read=await c.from('subscriptions').select('*').eq('user_id',b);
  check('Langganan pengguna lain tidak terbaca',!read.error&&read.data.length===0);
  for(const id of [c.testUserId,b]){
   const update=await c.from('subscriptions').update({plan:'pro',status:'active',expires_at:new Date(Date.now()+86400000).toISOString()}).eq('user_id',id);
   check('Tidak dapat mengubah langganan sendiri/lintas pemilik',update.error?.code==='42501');
  }
  const insert=await c.from('subscriptions').insert({user_id:c.testUserId,plan:'pro',status:'active',expires_at:new Date(Date.now()+86400000).toISOString()});
  check('Tidak dapat mengaktifkan premium sendiri',insert.error?.code==='42501');
  const config=await c.from('plans').update({reports_access:true}).eq('code','free');
  check('Konfigurasi paket tidak dapat diubah pengguna',config.error?.code==='42501');
 }
 result.status='passed';
 console.log('Pengujian Premium aktif/kedaluwarsa dan batas: jalankan .rls-entitlements-test.sql di SQL Editor. Semua fixture di-rollback.');
}catch(e){console.error(`VERIFICATION ${result.status.toUpperCase()}: ${e.message}`);process.exitCode=1;}
finally{for(const c of clients) await c.auth.signOut();writeFileSync('docs/entitlements-result.json',JSON.stringify(result,null,2)+'\n');console.log(`Hasil API: ${result.status}; pengujian SQL Premium: pending.`);}
