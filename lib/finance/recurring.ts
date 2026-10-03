export function nextDue(anchor:string,frequency:'weekly'|'monthly',after:string){
 const d=new Date(`${after}T00:00:00Z`);
 if(frequency==='weekly')d.setUTCDate(d.getUTCDate()+7);
 else {const day=Number(anchor.slice(8));d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+1);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));}
 return d.toISOString().slice(0,10);
}
export function dueDates(anchor:string,frequency:'weekly'|'monthly',next:string,today:string,end:string|null=null,limit=500){
 const dates:string[]=[];let due=next;while(due<=today&&(!end||due<=end)&&dates.length<limit){dates.push(due);due=nextDue(anchor,frequency,due);}return {dates,next:due,more:due<=today&&(!end||due<=end)};
}
