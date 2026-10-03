import {test} from 'node:test';import assert from 'node:assert/strict';import {goalProjection} from './projection';
const goal={id:'1',name:'Target',target:20000,saved:0,monthly:10000};
test('projection zero, achieved, insufficient history and no surplus',()=>{
 assert.equal(goalProjection([{...goal,monthly:0}],'2026-01-31',20000).goals[0].status,'zero');
 assert.equal(goalProjection([{...goal,saved:20000}],'2026-01-31',null).goals[0].months,0);
 assert.equal(goalProjection([goal],'2026-01-31',null).goals[0].date,null);
 assert.equal(goalProjection([goal],'2026-01-31',0).goals[0].status,'unfunded');
});
test('competing goals share available surplus; simulation never mutates input',()=>{
 const goals=[goal,{...goal,id:'2'}];const p=goalProjection(goals,'2026-01-31',10000);assert.equal(p.competing,true);assert.equal(p.goals[0].funded,5000);assert.equal(p.goals[0].months,4);
 goalProjection(goals,'2026-01-31',10000,{id:'1',monthly:20000});assert.equal(goal.monthly,10000);
});
test('month end clamps and very distant estimates do not overflow date',()=>{
 assert.equal(goalProjection([{...goal,monthly:20000}],'2026-01-31',20000).goals[0].date,'2026-02-28');
 assert.equal(goalProjection([{...goal,target:1e12,monthly:1}],'2026-01-31',1).goals[0].date,null);
});
