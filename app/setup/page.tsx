'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import Wordmark from '@/components/wordmark';
type Check={name:string;status:'ok'|'error'|'waiting';detail:string};
export default function Setup(){
 const [checks,setChecks]=useState<Check[]>([]),[busy,setBusy]=useState(false);
 async function run(){setBusy(true);setChecks([]);if(!supabase){setChecks([{name:'Environment',status:'error',detail:'Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di .env.local, lalu restart server.'}]);setBusy(false);return;}
 const results:Check[]=[{name:'Environment',status:'ok',detail:'Kedua variabel tersedia. Nilai key tidak ditampilkan.'}];
 try{const {error}=await supabase.auth.getSession();if(error)throw error;
 // /auth/v1/settings verifies URL/key against the remote Auth service without exposing their values.
 const response=await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`,{headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!},signal:AbortSignal.timeout(10000)});
 results.push({name:'Supabase Auth',status:response.ok?'ok':'error',detail:response.ok?'Server Auth dapat dijangkau dan menerima public key.':'Server Auth menolak pemeriksaan. Periksa URL dan anon/publishable key proyek.'});
 if(response.ok){const {data:{session}}=await supabase.auth.getSession();if(session){const {error}=await supabase.from('profiles').select('user_id').eq('user_id',session.user.id).limit(1);results.push({name:'Database Phase 1',status:error?'error':'ok',detail:error?'Tabel profiles belum dapat dibaca. Pastikan migration dijalankan.':'Tabel profiles dapat diakses dengan sesi pengguna. Isolasi dua akun tetap perlu diuji terpisah.'});}else{results.push({name:'Database Phase 1',status:'waiting',detail:'Masuk dahulu melalui halaman utama, lalu ulangi cek. Akses anonim ke data pribadi memang dibatasi RLS.'});}}
 }catch{results.push({name:'Koneksi',status:'error',detail:'Pemeriksaan gagal atau timeout. Periksa URL, koneksi jaringan, serta konfigurasi proyek Supabase.'});}finally{setChecks(results);setBusy(false);}}
 return <main className="onboarding"><Wordmark/><section className="panel"><div className="eyebrow">SETUP</div><h1>Cek koneksi Supabase</h1><p className="muted" style={{margin:'16px 0'}}>Pemeriksaan memakai public key dan sesi akunmu. Tidak menampilkan key atau data keuangan.</p><button className="button primary" disabled={busy} onClick={run}>{busy?'Memeriksa…':'Periksa koneksi'}</button><div aria-live="polite">{checks.map(c=><div key={c.name} className="notice" style={{background:c.status==='ok'?'#edf8f0':c.status==='waiting'?'var(--blue-50)':'#f9eee7',color:'var(--text)'}}><strong>{c.status==='ok'?'Berhasil':c.status==='waiting'?'Belum diperiksa':'Perlu diperbaiki'} · {c.name}</strong><p>{c.detail}</p></div>)}</div><a className="text-button" href="/">Kembali ke My Budget</a></section></main>;
}
