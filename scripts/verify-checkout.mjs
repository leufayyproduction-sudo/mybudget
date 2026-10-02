import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import {createClient} from '@supabase/supabase-js';
if(existsSync('.env.local'))loadEnvFile('.env.local');if(existsSync('.env.rls-test'))loadEnvFile('.env.rls-test');
const result={status:'blocked',checked_at:new Date().toISOString(),checks:[],sql_test:'pending',real_payments:'not_tested'};const clients=[];
const check=(label,ok)=>{result.checks.push({label,passed:ok});if(!ok){result.status='failed';throw new Error(label);}console.log(`PASS ${label}`);};
try{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)throw new Error('Environment Supabase belum lengkap.');
 let safe=key.startsWith('sb_publishable_');try{safe ||= JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon';}catch{}
 if(!safe||process.env.RLS_TEST_ALLOW_FIXTURES!=='dedicated-test-accounts')throw new Error('Gunakan public key dan dua akun uji khusus.');
 const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}};
 for(const letter of ['A','B']){const c=createClient(url,key,opts);clients.push(c);const r=await c.auth.signInWithPassword({email:process.env[`RLS_TEST_${letter}_EMAIL`]||'',password:process.env[`RLS_TEST_${letter}_PASSWORD`]||''});if(r.error)throw new Error('Login akun uji gagal.');c.testId=r.data.user.id;}
 check('Dua akun berbeda',clients[0].testId!==clients[1].testId);
 writeFileSync('.rls-checkout-test.sql',readFileSync('supabase/tests/manual_checkout.sql','utf8').replaceAll('__USER_A__',clients[0].testId).replaceAll('__USER_B__',clients[1].testId));
 console.log('Tes rollback disiapkan: .rls-checkout-test.sql. Tidak ada QRIS/pembayaran dibuat.');
 for(const c of clients){
  const orders=await c.rpc('list_my_orders');if(orders.error)throw new Error('Jalankan migration 005 lalu ulangi.');
  check('Akun uji belum memiliki pesanan (tidak membuat pesanan nyata)',orders.data.length===0);
  for(const table of ['orders','payment_confirmations','entitlements']){const r=await c.from(table).select('*').eq('user_id',clients.find(x=>x!==c).testId);check(`${table}: lintas pemilik tidak terbaca`,!r.error&&r.data.length===0);}
  const write=await c.from('orders').update({status:'paid'}).eq('user_id',c.testId);check('Status pesanan tidak dapat diubah pengguna',write.error?.code==='42501');
  const admin=await c.from('admin_users').insert({user_id:c.testId});check('Tidak dapat menjadi admin sendiri',admin.error?.code==='42501');
  const catalog=await c.from('products').select('code').eq('code','plus-30');check('Katalog aktif terbaca',!catalog.error&&catalog.data.length===1);
 }
 const anon=createClient(url,key,opts);const anonymous=await anon.rpc('list_my_orders');check('Pesanan menolak anonim',anonymous.error?.code==='42501');
 result.status='passed';
}catch(e){console.error(`VERIFICATION ${result.status.toUpperCase()}: ${e.message}`);process.exitCode=1;}
finally{for(const c of clients)await c.auth.signOut();writeFileSync('docs/checkout-result.json',JSON.stringify(result,null,2)+'\n');console.log(`Hasil API: ${result.status}; SQL: pending.`);}
