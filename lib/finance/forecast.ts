import {completedMonths,type AnalyticsData} from './analytics';
import {summary,spent} from './index';
export function quantile(values:number[],p:number){const a=[...values].sort((x,y)=>x-y);if(!a.length)return 0;const i=(a.length-1)*p,l=Math.floor(i);return a[l]+(a[Math.ceil(i)]-a[l])*(i-l);}
export function cashForecast(data:AnalyticsData,now:string){
 const months=completedMonths(data.transactions,now);if(months.length<3||!data.profile)return null;
 const income=months.map(m=>m.income),month=now.slice(0,7);
 const categories=new Set([...data.transactions.filter(t=>t.type==='expense'&&months.some(m=>m.month===t.date.slice(0,7))).map(t=>t.category),...data.budgets.filter(b=>b.month===month).map(b=>b.category)]);
 const expense=[...categories].reduce((total,c)=>total+Math.max(months.reduce((s,m)=>s+spent(data.transactions,c,m.month),0)/months.length,data.budgets.find(b=>b.month===month&&b.category===c)?.amount||0),0);
 const balance=summary(data.transactions,data.profile.opening,month).balance;
 const scenarios=[quantile(income,0.25),quantile(income,0.5),quantile(income,0.75)];
 const points=Array.from({length:91},(_,day)=>{const d=new Date(`${now}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+day);return {day,date:d.toISOString().slice(0,10),careful:Math.round(balance+(scenarios[0]-expense)*day/30),realistic:Math.round(balance+(scenarios[1]-expense)*day/30),optimistic:Math.round(balance+(scenarios[2]-expense)*day/30)};});
 return {months:months.map(m=>m.month),income:scenarios,expense,balance,points,negativeDate:points.find(p=>p.careful<0)?.date||null};
}
