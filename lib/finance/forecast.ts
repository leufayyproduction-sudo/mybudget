import {completedMonths,type AnalyticsData} from './analytics';
import {summary,spent} from './index';
import {nextDue} from './recurring';
export type ForecastRule={amount:number;type:'income'|'expense';category:string;frequency:'weekly'|'monthly';starts_on:string;ends_on:string|null;next_on:string;active:boolean};
export function quantile(values:number[],p:number){const a=[...values].sort((x,y)=>x-y);if(!a.length)return 0;const i=(a.length-1)*p,l=Math.floor(i);return a[l]+(a[Math.ceil(i)]-a[l])*(i-l);}
export function cashForecast(data:AnalyticsData,now:string,rules:ForecastRule[]=[]){
 const months=completedMonths(data.transactions,now);if(months.length<3||!data.profile)return null;
 const month=now.slice(0,7),end=new Date(`${now}T00:00:00Z`);end.setUTCDate(end.getUTCDate()+90);const until=end.toISOString().slice(0,10);
 const events:{date:string;type:'income'|'expense';category:string;amount:number}[]=[];
 for(const r of rules.filter(r=>r.active)){let due=r.next_on;while(due<=until&&(!r.ends_on||due<=r.ends_on)){if(due>now)events.push({date:due,type:r.type,category:r.category,amount:r.amount});due=nextDue(r.starts_on,r.frequency,due);}}
 const known=(type:'income'|'expense',category?:string)=>events.filter(e=>e.type===type&&(!category||e.category===category)).reduce((s,e)=>s+e.amount,0)/3;
 const historical=data.transactions.filter(t=>months.some(m=>m.month===t.date.slice(0,7)));
 const incomeCategories=new Set(historical.filter(t=>t.type==='income').map(t=>t.category));
 const income=months.map(m=>[...incomeCategories].reduce((s,c)=>{const ts=historical.filter(t=>t.type==='income'&&t.category===c&&t.date.startsWith(m.month)),manual=ts.filter(t=>t.origin!=='recurring').reduce((a,t)=>a+t.amount,0),tagged=historical.some(t=>t.type==='income'&&t.category===c&&t.origin==='recurring');return s+Math.max(0,manual-(tagged?0:known('income',c)));},0));
 const categories=new Set([...data.transactions.filter(t=>t.type==='expense'&&months.some(m=>m.month===t.date.slice(0,7))).map(t=>t.category),...data.budgets.filter(b=>b.month===month).map(b=>b.category)]);
 const residualExpense=[...categories].reduce((total,c)=>{const tagged=historical.some(t=>t.type==='expense'&&t.category===c&&t.origin==='recurring'),average=months.reduce((s,m)=>s+spent(data.transactions.filter(t=>t.origin!=='recurring'),c,m.month),0)/months.length;return total+Math.max(0,average-(tagged?0:known('expense',c)),(data.budgets.find(b=>b.month===month&&b.category===c)?.amount||0)-known('expense',c));},0);
 const expense=residualExpense+known('expense');
 const balance=summary(data.transactions,data.profile.opening,month).balance;
 const scenarios=[quantile(income,0.25),quantile(income,0.5),quantile(income,0.75)];
 const points=Array.from({length:91},(_,day)=>{const d=new Date(`${now}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+day);const date=d.toISOString().slice(0,10),scheduled=events.filter(e=>e.date<=date).reduce((s,e)=>s+(e.type==='income'?e.amount:-e.amount),0);return {day,date,careful:Math.round(balance+scheduled+(scenarios[0]-residualExpense)*day/30),realistic:Math.round(balance+scheduled+(scenarios[1]-residualExpense)*day/30),optimistic:Math.round(balance+scheduled+(scenarios[2]-residualExpense)*day/30)};});
 return {months:months.map(m=>m.month),income:scenarios.map(v=>v+known('income')),expense,balance,points,events:events.length,overdue:rules.filter(r=>r.active&&r.next_on<=now&&(!r.ends_on||r.next_on<=r.ends_on)).length,negativeDate:points.find(p=>p.careful<0)?.date||null};
}
