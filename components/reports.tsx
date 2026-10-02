'use client';
import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowDownLeft, ArrowUpRight, ChartNoAxesCombined, LockKeyhole } from 'lucide-react';
import { getEntitlement } from '@/lib/entitlements';
import { supabase } from '@/lib/supabase';
import { report } from '@/lib/finance/reports';
import { rupiah, type Transaction } from '@/lib/finance';
const monthLabel = (month: string) => new Date(`${month}-01T12:00:00`).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
export function LockedReports({ upgrade }: { upgrade: () => void }) {
 return <section className="panel report-locked"><div className="section-icon"><LockKeyhole size={24}/></div><span className="eyebrow">LAPORAN PREMIUM</span><h2>Kenali pola uangmu lebih jauh.</h2><p>Laporan tersedia untuk paket Plus atau Pro yang masih aktif. Transaksimu tetap tersimpan dan bisa kamu kelola.</p><ul><li>Arus kas pemasukan dan pengeluaran enam bulan</li><li>Kategori pengeluaran terbesar</li><li>Perbandingan dengan bulan sebelumnya</li></ul><button className="button primary" onClick={upgrade}>Upgrade ke Premium</button><small>Pengaktifan paket belum tersedia di sesi ini.</small></section>;
}
export default function Reports({ user, month, onMonthChange, add, upgrade }: { user: string; month: string; onMonthChange: (month:string) => void; add: () => void; upgrade: () => void }) {
 const [state, setState] = useState<'loading'|'locked'|'ready'|'error'>('loading');
 const [rows, setRows] = useState<Transaction[]>([]);
 const [expires, setExpires] = useState<number|null>(null);
 useEffect(() => {
  let alive = true;
  async function load() {
   setState('loading'); setRows([]);
   if (user === 'demo' || !supabase) { if (alive) setState('locked'); return; }
   try {
    const e = await getEntitlement();
    if (!alive) return;
    if (!e.reports_access) { setState('locked'); return; }
    const r = await supabase.rpc('get_report_transactions', { p_month: month });
    if (!alive) return;
    if (r.error) { setState(r.error.code === '42501' ? 'locked' : 'error'); return; }
    const deadline = e.expires_at ? Date.parse(e.expires_at) : null;
    if (deadline !== null && deadline <= Date.now()) { setState('locked'); return; }
    setExpires(deadline); setRows((r.data || []).map((t: {id:string;data:Omit<Transaction,'id'>}) => ({...t.data,id:t.id}))); setState('ready');
   } catch { if (alive) setState('error'); }
  }
  void load();
  const recheck = () => { void load(); };
  window.addEventListener('focus',recheck);
  const timer = setInterval(recheck,60000);
  return () => { alive=false; clearInterval(timer); window.removeEventListener('focus',recheck); };
 },[user,month]);
 useEffect(() => {
  if (expires === null) return;
  const timer = setInterval(() => { if (Date.now() >= expires) { setRows([]); setState('locked'); clearInterval(timer); } },1000);
  return () => clearInterval(timer);
 },[expires]);
 if (state==='loading') return <section className="panel" role="status"><div className="skeleton review-skeleton"/>Memeriksa akses laporan…</section>;
 if (state==='locked') return <LockedReports upgrade={upgrade}/>;
 if (state==='error') return <section className="panel" role="alert"><h2>Laporan belum dapat dibuka.</h2><p className="muted">Periksa koneksi dan migration 004, lalu buka kembali menu Laporan.</p></section>;
 return <><label className="month-input report-month">Bulan laporan<input type="month" value={month} onChange={e=>e.target.value&&onMonthChange(e.target.value)}/></label><ReportContent transactions={rows} month={month} add={add}/></>;
}
function ReportContent({ transactions, month, add }: { transactions: Transaction[]; month: string; add: () => void }) {
 const r = report(transactions, month);
 return <div className="reports">
  <div className="report-summary"><div><span><ArrowDownLeft size={16}/> Pemasukan · {monthLabel(month)}</span><strong className="money">+{rupiah(r.current.income)}</strong><small>{r.incomeChange.label} dibanding bulan lalu</small></div><div><span><ArrowUpRight size={16}/> Pengeluaran · {monthLabel(month)}</span><strong className="money">−{rupiah(r.current.expense)}</strong><small>{r.expenseChange.label} dibanding bulan lalu</small></div></div>
  {!r.hasData ? <section className="panel review-empty"><ChartNoAxesCombined size={28}/><strong>Belum ada arus kas dalam enam bulan ini.</strong><p>Catat pemasukan atau pengeluaran pertama untuk melihat laporanmu.</p><button className="button primary" onClick={add}>Catat transaksi pertama</button></section> : <section className="panel"><div className="section-heading"><div><h2>Arus kas enam bulan</h2><p>Pemasukan dan pengeluaran aktual, tanpa saldo awal atau alokasi target.</p></div></div><div className="chart-legend"><span>■ Pemasukan (+)</span><span>▨ Pengeluaran (−)</span></div><div className="report-chart" role="img" aria-label="Grafik arus kas enam bulan. Nilai lengkap tersedia dalam tabel di bawah."><ResponsiveContainer width="100%" height="100%"><BarChart data={r.series} margin={{ left: 0, right: 8, top: 16 }}><defs><pattern id="report-expense" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#64748b"/><path d="M0 6L6 0" stroke="#e2e8f0" strokeWidth="1.5"/></pattern></defs><XAxis dataKey="month" tickFormatter={monthLabel} tickLine={false} axisLine={false} tick={{ fontSize: 11 }}/><YAxis width={55} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} tickFormatter={v => new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(v)}/><Tooltip formatter={v => rupiah(Number(v))} labelFormatter={v => monthLabel(String(v))}/><Bar dataKey="income" name="Pemasukan (+)" fill="#2563eb" radius={[4,4,0,0]}/><Bar dataKey="expense" name="Pengeluaran (−)" fill="url(#report-expense)" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div><details className="report-table"><summary>Lihat angka per bulan</summary><table><caption className="sr-only">Arus kas enam bulan dalam rupiah</caption><thead><tr><th>Bulan</th><th>Pemasukan (+)</th><th>Pengeluaran (−)</th></tr></thead><tbody>{r.series.map(s => <tr key={s.month}><th>{monthLabel(s.month)}</th><td className="money">{rupiah(s.income)}</td><td className="money">{rupiah(s.expense)}</td></tr>)}</tbody></table></details></section>}
  <section className="panel"><div className="section-heading"><div><h2>Ke mana uangmu pergi?</h2><p>Kategori pengeluaran bulan {monthLabel(month)}, dari yang terbesar.</p></div></div>{!r.categories.length ? <div className="review-empty"><strong>Belum ada pengeluaran bulan ini.</strong><p>Catat yang pertama untuk melihat pembagiannya.</p><button className="button secondary" onClick={add}>Tambah pengeluaran</button></div> : <ol className="report-categories">{r.categories.map((c, i) => <li key={c.name}><span className="report-rank">{i+1}</span><div><div className="report-category-title"><strong>{c.name}</strong><span className="money">{rupiah(c.amount)}</span></div><div className="progress" role="progressbar" aria-label={`Porsi ${c.name}`} aria-valuenow={Math.round(c.share)} aria-valuemin={0} aria-valuemax={100}><i style={{width:`${c.share}%`}}/></div><small>{new Intl.NumberFormat('id-ID', {maximumFractionDigits:1}).format(c.share)}% dari pengeluaran bulan ini</small></div></li>)}</ol>}</section>
  <p className="muted">Bulan berjalan belum selesai; perbandingan bukan prediksi. Laporan lanjutan: segera hadir.</p>
 </div>;
}
