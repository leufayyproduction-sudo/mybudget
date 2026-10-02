'use client';
import {useState} from 'react';
import Link from 'next/link';
import {LockKeyhole} from 'lucide-react';
import {supabase} from '@/lib/supabase';
import Wordmark from './wordmark';
export default function AdminConnect(){const [error,setError]=useState(''),[busy,setBusy]=useState(false);async function connect(){setBusy(true);setError('');try{const session=await supabase?.auth.getSession();const token=session?.data.session?.access_token;if(!token)throw new Error('Masuk terlebih dahulu di halaman utama dengan akun admin.');const r=await fetch('/api/admin/session',{method:'POST',headers:{Authorization:`Bearer ${token}`}});const data=await r.json();if(!r.ok)throw new Error(data.error);window.location.assign('/admin');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}return <main className="admin-connect"><Wordmark/><section className="panel form"><LockKeyhole size={28}/><h1>Ruang admin</h1><p className="muted">Kelola pembelian dan konten My Budget. Akunmu harus sudah diberi role admin oleh pemilik proyek melalui SQL.</p>{error&&<p role="alert" className="form-error">{error}</p>}<button className="button primary" disabled={busy} onClick={connect}>{busy?'Memeriksa akses…':'Buka dengan akun yang sedang masuk'}</button><Link href="/">Kembali ke halaman utama</Link></section></main>;}
