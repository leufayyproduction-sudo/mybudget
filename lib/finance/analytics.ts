import {summary,spent,type Transaction,type Budget,type Goal,type Profile} from './index';
export type AnalyticsData={profile:Profile|null;transactions:Transaction[];budgets:Budget[];goals:Goal[]};
export function completedMonths(ts:Transaction[],now:string){
 const end=new Date(`${now.slice(0,7)}-01T00:00:00Z`);
 const first=ts.map(t=>t.date.slice(0,7)).sort()[0];
 return Array.from({length:6},(_,i)=>{const d=new Date(end);d.setUTCMonth(d.getUTCMonth()-6+i);return d.toISOString().slice(0,7);}).filter(m=>first&&m>=first).map(month=>({month,...summary(ts,0,month)}));
}
const clamp=(n:number)=>Math.max(0,Math.min(100,n));
export function financialHealth(data:AnalyticsData,now:string){
 const months=completedMonths(data.transactions,now);
 if(months.length<2||!data.profile)return null;
 const income=months.reduce((s,m)=>s+m.income,0),expense=months.reduce((s,m)=>s+m.expense,0);
 const budgets=data.budgets.filter(b=>months.some(m=>m.month===b.month));
 // Do not fabricate a budget or an expense denominator.
 if(!income||!expense||!budgets.length)return null;
 const balance=summary(data.transactions,data.profile.opening,now.slice(0,7)).balance;
 const mean=income/months.length;
 const cv=Math.sqrt(months.reduce((s,m)=>s+(m.income-mean)**2,0)/months.length)/mean;
 const variable=data.profile.pattern!=='Penghasilan tetap';
 const parts=[
  {name:'Rasio tabungan',score:clamp((income-expense)/income/0.2*100),weight:variable?30:40,method:'Surplus aktual ÷ pemasukan; 20% mencapai skor 100.',tip:'Coba sisihkan sebagian pemasukan setiap project selesai.'},
  {name:'Kepatuhan budget',score:budgets.reduce((s,b)=>s+clamp(100-Math.max(0,spent(data.transactions,b.category,b.month)-b.amount)/b.amount*100),0)/budgets.length,weight:30,method:'Rata-rata skor budget tercatat: 100 dikurangi persentase kelebihan.',tip:'Sesuaikan batas kategori yang sering terlewati dengan kebutuhanmu.'},
  {name:'Dana darurat',score:clamp(Math.max(0,balance)/(expense/months.length)/3*100),weight:variable?25:30,method:'Saldo aktual ÷ pengeluaran rata-rata; 3 bulan mencapai skor 100. Saldo belum tentu seluruhnya dana darurat.',tip:'Bangun cadangan bertahap untuk satu bulan pengeluaran dulu.'},
  ...(variable?[{name:'Stabilitas pemasukan',score:clamp((1-cv)*100),weight:15,method:'100 × (1 − deviasi standar ÷ rata-rata pemasukan), dibatasi 0–100.',tip:'Gunakan bulan berpendapatan tinggi untuk menambah cadangan.'}]:[])
 ];
 return {score:Math.round(parts.reduce((s,p)=>s+p.score*p.weight/100,0)),parts,weakest:[...parts].sort((a,b)=>a.score-b.score)[0],months:months.map(m=>m.month)};
}
