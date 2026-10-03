import {test} from 'node:test';import assert from 'node:assert/strict';
import {financialHealth,completedMonths,type AnalyticsData} from './analytics';
const data:AnalyticsData={profile:{name:'Uji',purpose:'Menabung',pattern:'Campuran',opening:20000,fixed:0,project:20000,projects:1},transactions:[],budgets:[],goals:[]};
test('health requires actual history, budgets and nonzero denominators',()=>{assert.equal(financialHealth(data,'2026-10-03'),null);assert.equal(completedMonths([], '2026-10-03').length,0);});
test('health includes empty months and handles unstable Rp20.000 income',()=>{
 const d={...data,transactions:[{id:'1',amount:20000,type:'income' as const,category:'Project',description:'',date:'2026-08-01'},{id:'2',amount:10000,type:'expense' as const,category:'Tagihan',description:'',date:'2026-09-01'}],budgets:[{id:'b',category:'Tagihan',amount:10000,month:'2026-09',mandatory:true}]};
 const h=financialHealth(d,'2026-10-03')!;assert.ok(h.score>=0&&h.score<=100);assert.equal(h.parts.reduce((s,p)=>s+p.weight,0),100);assert.equal(h.months.length,2);assert.equal(h.parts[3].score,0);
});
