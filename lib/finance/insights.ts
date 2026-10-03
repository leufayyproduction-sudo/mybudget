import {rupiah,type Transaction} from './index';
export type Insight={key:string;priority:number;title:string;text:string;assumption:string};
export const insightThresholds={difference:20000,change:0.2,categoryCount:3,outlier:50000,outlierMultiple:3,baselineCount:5,hotspotCount:10,limit:5} as const;
const total=(ts:Transaction[])=>ts.reduce((s,t)=>s+t.amount,0);
function previousMonth(month:string,offset:number){const d=new Date(`${month}-01T00:00:00Z`);d.setUTCMonth(d.getUTCMonth()-offset);return d.toISOString().slice(0,7);}
export function advancedInsights(transactions:Transaction[],now:string,dismissed:string[]=[]){
 const month=now.slice(0,7),day=Number(now.slice(8)),previous=previousMonth(month,1);
 const expenses=transactions.filter(t=>t.type==='expense'&&t.date<=now);
 const history=transactions.map(t=>t.date.slice(0,7)).sort()[0];
 const eligible=!!history&&history<=previous;
 const current=expenses.filter(t=>t.date.startsWith(month));
 const result:Insight[]=[];
 const add=(kind:string,id:string,priority:number,title:string,text:string,assumption:string)=>result.push({key:`v1:${month}:${kind}:${id}`,priority,title,text,assumption});
 if(!eligible||current.length<3)return {eligible:false,items:[],candidateCount:0};
 for(const category of new Set(current.map(t=>t.category))){
  const a=current.filter(t=>t.category===category);if(a.length<insightThresholds.categoryCount)continue;
  const old=expenses.filter(t=>t.category===category&&t.date.startsWith(previous)&&Number(t.date.slice(8))<=day);
  const value=total(a),base=total(old),delta=value-base;
  if(Math.abs(delta)>=insightThresholds.difference&&(base===0||Math.abs(delta)/base>=insightThresholds.change)&&(base===0||old.length>=3)){
   add(delta>0?'increase':'improve',category,delta>0?80:50,delta>0?`${category} meningkat`:`${category} membaik`,base===0?`${rupiah(value)} tercatat; belum ada pembanding bulan lalu.`:`${delta>0?'Naik':'Turun'} ${rupiah(Math.abs(delta))} (${Math.round(Math.abs(delta)/base*100)}%) dibanding bulan lalu.`,`${month} sampai ${now}; pembanding ${previous} sampai hari ${day}. Minimal 3 transaksi kategori, perubahan Rp20.000 dan 20%; tidak mengasumsikan pencatatan lengkap.`);
  }
  const past=Array.from({length:3},(_,i)=>previousMonth(month,i+1));
  const sampled=expenses.filter(t=>t.category===category&&past.includes(t.date.slice(0,7))&&Number(t.date.slice(8))<=day);
  const average=total(sampled)/3;
  if(history<=past[2]&&sampled.length>=5&&average>0&&value-average>=20000&&value>=average*1.5){add('three-month',category,70,`${category} di atas patokan`,`${rupiah(value)} dibanding patokan ${rupiah(average)}.`,`Rata-rata 3 bulan sebelumnya sampai hari ${day}, termasuk bulan kosong; minimum 5 transaksi pembanding, selisih Rp20.000 dan kenaikan 50%.`);}
 }
 const baseline=expenses.filter(t=>t.date.startsWith(previous)).map(t=>t.amount).sort((a,b)=>a-b);
 if(baseline.length>=5){const middle=Math.floor(baseline.length/2),median=baseline.length%2?baseline[middle]:(baseline[middle-1]+baseline[middle])/2;
  for(const t of current)if(t.amount>=50000&&t.amount>=median*3)add('outlier',t.id,90,'Transaksi lebih besar dari biasanya',`${t.description||t.category}: ${rupiah(t.amount)}. Periksa apakah ini pengeluaran yang memang direncanakan.`,`Dibanding median ${baseline.length} pengeluaran bulan sebelumnya; minimum Rp50.000 dan 3× median. Bukan deteksi penipuan.`);
 }
 if(current.length>=10&&total(current)>=50000){const groups=new Map<string,Transaction[]>();for(const t of current){const list=groups.get(t.date)||[];list.push(t);groups.set(t.date,list);}const peak=[...groups].sort((a,b)=>total(b[1])-total(a[1]))[0];if(peak&&peak[1].length>=3&&total(peak[1])>=total(current)*0.35)add('day',peak[0],40,'Pengeluaran terkumpul pada satu hari',`${peak[0]}: ${rupiah(total(peak[1]))}, ${Math.round(total(peak[1])/total(current)*100)}% pengeluaran bulan ini.`,`Minimal 10 transaksi bulan ini, total Rp50.000, 3 transaksi pada hari tersebut, dan porsi 35%. Tidak menyimpulkan kebiasaan dari satu hari.`);}
 const filtered=result.filter(i=>!dismissed.includes(i.key)).sort((a,b)=>b.priority-a.priority||a.key.localeCompare(b.key));
 return {eligible:true,items:filtered.slice(0,insightThresholds.limit),candidateCount:filtered.length};
}
