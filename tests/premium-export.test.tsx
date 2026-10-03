import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {SupabaseClient} from '@supabase/supabase-js';
import {premiumExport} from '../lib/premium-export';
function fixture(plan:string|null,error=false,queryError=false){
 let reads=0;
 const data=[{id:'owner',data:{date:'2026-10-03',type:'income',amount:20000,category:'Project',description:'=BAD'}}];
 const c={rpc:async()=>({data:plan?{plan}:null,error:error?{}:null}),from:(table:string)=>{assert.equal(table,'transactions');reads++;return {select:()=>({order:()=>({range:async()=>({data,error:queryError?{}:null})})})};}};
 return {c:c as unknown as SupabaseClient,reads:()=>reads};
}
test('Free, expired resolver and unavailable entitlement fail closed before reading transactions',async()=>{
 for(const [plan,error,status] of [['free',false,403],['free',false,403],[null,false,403],['pro',true,503]] as const){const f=fixture(plan,error);assert.equal((await premiumExport(f.c)).status,status);assert.equal(f.reads(),0);}
});
test('Plus and Pro export user-client rows, small amounts and safe formula cells',async()=>{
 for(const plan of ['plus','pro']){const f=fixture(plan);const r=await premiumExport(f.c);assert.equal(r.status,200);assert.match(r.headers.get('content-type')!,/text\/csv/);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.match(await r.text(),/20000;"Project";"'=BAD"/);assert.equal(f.reads(),1);}
});
test('Database error never returns a partial CSV',async()=>{const f=fixture('plus',false,true);assert.equal((await premiumExport(f.c)).status,503);});
