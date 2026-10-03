'use client';
import {useState,type FormEvent} from 'react';
import Link from 'next/link';
import {LockKeyhole} from 'lucide-react';
import Wordmark from './wordmark';
const failure='Email atau password salah atau akun tidak memiliki akses admin';
export default function AdminLogin(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError('');try{
  const r=await fetch('/api/admin/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  setPassword('');if(!r.ok){setError(failure);return;}
  window.location.assign('/admin');
 }catch{setError(failure);}finally{setBusy(false);}}
 return <main className="admin-connect admin-login"><Wordmark/><section className="panel"><div className="admin-login-heading"><LockKeyhole size={24}/><span className="eyebrow">AKSES ADMIN</span></div><h1>Masuk ke ruang admin</h1><p className="muted">Kelola pembelian, produk, dan konten My Budget.</p><form className="form" onSubmit={submit}><label>Email<input autoFocus type="email" name="email" autoComplete="username" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input type="password" name="password" autoComplete="current-password" required maxLength={1024} value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<p className="form-error" role="alert">{error}</p>}<button className="button primary" disabled={busy}>{busy?'Memeriksa akses…':'Masuk sebagai admin'}</button></form><Link className="text-button" href="/">Kembali ke My Budget</Link></section></main>;
}
