'use client';
import {usePathname} from 'next/navigation';
import {useState} from 'react';
export default function AdminLogout(){const path=usePathname(),[busy,setBusy]=useState(false),[error,setError]=useState('');if(path==='/admin/login'||path==='/admin/connect')return null;return <div className="admin-session-controls">{error&&<span role="alert">{error}</span>}<button className="button secondary" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const r=await fetch('/api/admin/session',{method:'DELETE',credentials:'same-origin'});if(!r.ok)throw new Error();window.location.assign('/admin/login');}catch{setError('Sesi belum dapat ditutup. Coba lagi.');setBusy(false);}}}>{busy?'Menutup sesi…':'Keluar dari admin'}</button></div>;}
