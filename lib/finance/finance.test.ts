import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summary, safeToSpend, monthsToGoal, averageIncome, type Transaction } from './index';
const ts: Transaction[]=[{id:'1',amount:20000,type:'income',category:'Project',description:'',date:'2026-10-01'},{id:'2',amount:5000,type:'expense',category:'Makan',description:'',date:'2026-10-02'}];
test('nominal kecil dan saldo awal tepat',()=>assert.deepEqual(summary(ts,10000,'2026-10'),{income:20000,expense:5000,balance:25000}));
test('alokasi hanya memengaruhi aman dibelanjakan',()=>assert.equal(safeToSpend(ts,[{id:'b',category:'Makan',amount:10000,month:'2026-10',mandatory:true}],[{id:'g',name:'G',target:50000,saved:0,monthly:2000}],10000,'2026-10'),18000));
test('goal nol dan tercapai',()=>{assert.equal(monthsToGoal({id:'g',name:'G',target:100,saved:0,monthly:0}),null);assert.equal(monthsToGoal({id:'g',name:'G',target:100,saved:100,monthly:0}),0);});
test('rata-rata memakai tiga bulan selesai termasuk bulan kosong',()=>assert.equal(averageIncome(ts,'2026-11'),20000/3));
