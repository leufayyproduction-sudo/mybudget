import {type Transaction} from './index';
export type Period={from:string;to:string};
export function reportChange(current:number,previous:number){return previous===0?{percent:null,label:current===0?'Tidak ada pembanding':'Baru'}:{percent:(current-previous)/previous*100,label:'Dibanding periode pembanding'};}
const inPeriod=(t:Transaction,p:Period)=>t.date>=p.from&&t.date<=p.to;
export function advancedReport(input:Transaction[],period:Period,comparison:Period){
 const unique=[...new Map(input.map(t=>[t.id,t])).values()];
 const transactions=unique.filter(t=>inPeriod(t,period)).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
 const previous=unique.filter(t=>inPeriod(t,comparison));
 const sums=(ts:Transaction[])=>{const income=ts.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0),expense=ts.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);return {income,expense,net:income-expense};};
 const current=sums(transactions),prior=sums(previous);
 const months:{month:string;income:number;expense:number;net:number}[]=[];
 const d=new Date(`${period.from.slice(0,7)}-01T00:00:00Z`),end=period.to.slice(0,7);
 while(d.toISOString().slice(0,7)<=end){const month=d.toISOString().slice(0,7);months.push({month,...sums(transactions.filter(t=>t.date.startsWith(month)))});d.setUTCMonth(d.getUTCMonth()+1);}
 const totals=new Map<string,number>();for(const t of transactions.filter(t=>t.type==='expense'))totals.set(t.category,(totals.get(t.category)||0)+t.amount);
 const categories=[...totals].map(([category,amount])=>({category,amount,share:current.expense?amount/current.expense:0})).sort((a,b)=>b.amount-a.amount||a.category.localeCompare(b.category));
 return {period,comparison,current,prior,changes:{income:reportChange(current.income,prior.income),expense:reportChange(current.expense,prior.expense)},months,categories,transactions};
}
function csvCell(value:string|number){const text=String(value),safe=typeof value==='string'&&(/^\s*[=+\-@]/.test(text)||/^[\t\r\n]/.test(text))?`'${text}`:text;return `"${safe.replaceAll('"','""')}"`;}
export function advancedReportCsv(report:ReturnType<typeof advancedReport>){
 const rows:(string|number)[][]=[['Bagian','Tanggal/periode','Jenis/kategori','Pemasukan (Rp)','Pengeluaran (Rp)','Deskripsi','ID transaksi'],['Ringkasan',`${report.period.from} – ${report.period.to}`,'Utama',report.current.income,report.current.expense,'',''],['Ringkasan',`${report.comparison.from} – ${report.comparison.to}`,'Pembanding',report.prior.income,report.prior.expense,'','']];
 for(const m of report.months)rows.push(['Tren',m.month,'',m.income,m.expense,'','']);
 for(const c of report.categories)rows.push(['Kategori',`${report.period.from} – ${report.period.to}`,c.category,0,c.amount,'','']);
 for(const t of report.transactions)rows.push(['Transaksi',t.date,t.type==='income'?'Pemasukan':'Pengeluaran',t.type==='income'?t.amount:0,t.type==='expense'?t.amount:0,`${t.category}: ${t.description}`,t.id]);
 return '\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');
}
