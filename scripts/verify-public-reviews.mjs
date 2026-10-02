import { loadEnvFile } from 'node:process';
import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
loadEnvFile('.env.local');
const report={checked_at:new Date().toISOString(),status:'blocked',checks:[]};
const test=(label,passed)=>{report.checks.push({label,passed});if(!passed)throw new Error(label);console.log(`PASS ${label}`);};
try{
 const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'';
 const valid=key.startsWith('sb_publishable_')||(!key.startsWith('sb_secret_')&&key.split('.').length===3&&JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon');
 if(!valid)throw new Error('Gunakan public key saja.');
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}});
 const list=await db.rpc('list_public_reviews',{p_limit:20});
 if(list.error)throw new Error('RPC baru belum dapat diakses. Jalankan migration 003 lalu ulangi.');
 const fields=['id','display_name','rating','body','created_at','updated_at'];
 test('RPC ulasan hanya mengeluarkan kolom publik',Array.isArray(list.data)&&list.data.every(row=>Object.keys(row).every(k=>fields.includes(k))));
 for(const table of ['reviews','public_reviews']){
  const r=await db.from(table).select('*').limit(1);
  test(`${table}: akses langsung anonim ditolak`,r.error?.code==='42501');
 }
 const totals=await db.rpc('review_summary');
 test('Ringkasan rating dapat dibaca publik',!totals.error&&Array.isArray(totals.data));
 report.status='passed';
}catch(e){report.reason=e.name==='TimeoutError'||e.message.includes('fetch')?'Koneksi belum tersedia.':e.message;console.log(`BLOCKED: ${report.reason}`);process.exitCode=2;}
writeFileSync('docs/public-reviews-result.json',JSON.stringify(report,null,2)+'\n');
console.log(`Hasil: ${report.status}. Tidak ada isi ulasan, user_id, atau key dicetak.`);
