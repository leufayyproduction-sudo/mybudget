'use client';
import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { getEntitlement, type Entitlement } from '@/lib/entitlements';
import { supabase } from '@/lib/supabase';
import { rupiah } from '@/lib/finance';
type Plan = {code:string;name:string;price_rupiah:number;duration_days:number|null;transactions_limit:number|null;categories_limit:number|null;goals_limit:number|null;budgets_limit:number|null;reports_access:boolean};
const limitLabel = (limit:number|null, unit:string) => limit === null ? `${unit} tanpa batas` : `${limit} ${unit}`;
export default function Premium({ user, reports }: {user:string;reports:()=>void}) {
 const [plans,setPlans]=useState<Plan[]>([]),[entitlement,setEntitlement]=useState<Entitlement|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{let alive=true;async function load(){try{
  if(!supabase) return;
  const r=await supabase.from('plans').select('*').order('price_rupiah');
  if(r.error) throw new Error('Katalog belum tersedia. Terapkan migration 004 lalu coba lagi.');
  const e=user==='demo'?null:await getEntitlement();
  if(alive){setPlans(r.data||[]);setEntitlement(e);}
 }catch(e){if(alive)setError((e as Error).message);}finally{if(alive)setLoading(false);}}void load();const recheck=()=>{void load();};window.addEventListener('focus',recheck);const timer=setInterval(recheck,60000);return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',recheck);};},[user]);
 return <div className="package-page"><section className="panel package-status"><ShieldCheck size={24}/><div><h2>{entitlement?`Paketmu: ${entitlement.name}`:user==='demo'?'Demo · akses Laporan terkunci':'Paket akun'}</h2><p className="muted">{entitlement?.expires_at?`Aktif sampai ${new Date(entitlement.expires_at).toLocaleString('id-ID')}.`:'Paket Free berlaku tanpa batas waktu. Premium kedaluwarsa kembali ke Free; data tetap tersimpan.'}</p></div>{entitlement?.reports_access&&<button className="button secondary" onClick={reports}>Buka Laporan</button>}</section>
 {loading&&<div className="skeleton review-skeleton" role="status" aria-label="Memuat paket"/>}{error&&<p className="form-error" role="alert">{error}</p>}
 <div className="package-grid">{plans.map(p=><section className="panel" key={p.code}><span className="eyebrow">{p.name}</span><h2 className="money">{rupiah(p.price_rupiah)}{p.duration_days&&<small>/{p.duration_days} hari</small>}</h2><ul><li>{limitLabel(p.transactions_limit,'transaksi per bulan')}</li><li>{limitLabel(p.categories_limit,'kategori kustom')}</li><li>{limitLabel(p.goals_limit,'target aktif')}</li><li>{limitLabel(p.budgets_limit,'kategori budget per bulan')}</li><li>{p.reports_access?'Laporan Premium':'Laporan Premium terkunci'}</li></ul><span className="pill">{p.code===entitlement?.plan?'Paket aktif':p.code==='free'?'Paket dasar':'Aktivasi belum tersedia'}</span></section>)}</div>
 <section className="panel"><h2>Pilih sesuai kebutuhanmu.</h2><p className="muted">Harga di atas adalah referensi paket. Pembelian dan checkout belum tersedia. Kamu tidak dapat mengaktifkan Premium sendiri.</p><p className="muted">Fitur Pro lanjutan, forecast, recurring, dan tools digital: segera hadir; belum tersedia untuk digunakan.</p></section></div>;
}
