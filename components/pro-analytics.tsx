'use client';
import {useEffect,useState} from 'react';import Link from 'next/link';import {LockKeyhole} from 'lucide-react';import {supabase} from '@/lib/supabase';
import type {financialHealth} from '@/lib/finance/analytics';
type Result={health:ReturnType<typeof financialHealth>;date:string};
export default function ProAnalytics({feature}:{feature:string}){
 const [result,setResult]=useState<Result|null>(null),[error,setError]=useState(''),[locked,setLocked]=useState(false),[loading,setLoading]=useState(true);
 useEffect(()=>{let alive=true;async function load(){try{
  const session=(await supabase?.auth.getSession())?.data.session;
  if(!session){if(alive){setResult(null);setLocked(true);}return;}
  const r=await fetch('/api/analytics',{headers:{Authorization:`Bearer ${session.access_token}`},cache:'no-store'});
  if(!alive)return;if(r.status===403||r.status===401){setResult(null);setLocked(true);return;}
  const body=await r.json();if(!r.ok)throw new Error(body.error);setResult(body);setLocked(false);setError('');
 }catch(e){if(alive){setResult(null);setError((e as Error).message);}}finally{if(alive)setLoading(false);}}
 void load();window.addEventListener('focus',load);const timer=setInterval(load,60000);return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',load);};},[]);
 if(loading)return <div className="skeleton review-skeleton" role="status" aria-label="Memeriksa akses Pro"/>;
 if(locked)return <section className="panel form"><LockKeyhole/><h1>Kenali keuanganmu lebih dekat.</h1><p>Pro membuka financial health, perkiraan arus kas, dan simulasi target. Akses diperiksa di server.</p><Link href="/?view=premium" className="button primary">Upgrade ke Pro</Link></section>;
 if(error)return <p className="form-error" role="alert">{error}</p>;
 if(!result)return null;
 if(feature==='health')return <section className="panel form"><h1>Financial health</h1>{!result.health?<p>Data belum cukup. Catat minimal 2 bulan penuh, pemasukan, pengeluaran dan budget pada periode tersebut.</p>:<><div className="balance-value money">{result.health.score}<small>/100</small></div><p>{result.health.weakest.tip}</p><details><summary>Metode dan asumsi</summary><p>Periode {result.health.months.join(', ')}. Bulan kosong dihitung nol. Surplus bukan alokasi goal; skor merupakan ringkasan, bukan nasihat investasi.</p></details>{result.health.parts.map(p=><article key={p.name}><h2>{p.name} · {Math.round(p.score)}/100</h2><progress max={100} value={p.score} aria-label={p.name}/><p className="muted">Bobot {p.weight}% · {p.method}</p></article>)}</>}</section>;
 return null;
}
