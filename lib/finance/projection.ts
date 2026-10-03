import type {Goal} from './index';import {completedMonths,type AnalyticsData} from './analytics';import {quantile} from './forecast';
export function allocationCapacity(data:AnalyticsData,now:string){const months=completedMonths(data.transactions,now);return months.length<2?null:Math.max(0,quantile(months.map(m=>m.income-m.expense),0.5));}
export function goalProjection(goals:Goal[],now:string,capacity:number|null,override?:{id:string;monthly:number}){
 const active=goals.filter(g=>g.saved<g.target);
 const monthly=(g:Goal)=>override?.id===g.id?override.monthly:g.monthly;
 const total=active.reduce((s,g)=>s+monthly(g),0);
 const ratio=capacity===null||total===0?1:Math.min(1,capacity/total);
 return {total,capacity,competing:capacity!==null&&total>capacity,goals:goals.map(g=>{
  const allocation=monthly(g),funded=Math.floor(allocation*ratio);
  const status=g.saved>=g.target?'achieved':allocation===0?'zero':capacity===null?'insufficient':funded===0?'unfunded':'estimated';
  const months=status==='achieved'?0:status==='estimated'?Math.ceil((g.target-g.saved)/funded):null;
  let date:string|null=null;
  if(months!==null&&months<=1200){const start=new Date(`${now}T00:00:00Z`);const target=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+months,1));const last=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();target.setUTCDate(Math.min(start.getUTCDate(),last));date=target.toISOString().slice(0,10);}
  return {...g,allocation,funded,status,months,date};
 })};
}
