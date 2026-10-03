import type {SupabaseClient} from '@supabase/supabase-js';
import type {Transaction} from './finance';
import {transactionsCsv} from './finance/csv';
// Receives the verified user's client only; table queries keep owner RLS.
export async function premiumExport(c:SupabaseClient){
 const e=await c.rpc('get_entitlement');
 if(e.error)return Response.json({error:'Hak ekspor belum dapat diperiksa.'},{status:503});
 if(!['plus','pro'].includes(e.data?.plan))return Response.json({error:'Ekspor CSV tersedia untuk Plus atau Pro aktif.'},{status:403});
 const rows:Transaction[]=[];
 for(let offset=0;;offset+=1000){
  const r=await c.from('transactions').select('id,data').order('id').range(offset,offset+999);
  if(r.error)return Response.json({error:'Transaksi belum dapat diekspor.'},{status:503});
  rows.push(...(r.data||[]).map(t=>({...t.data,id:t.id})) as Transaction[]);
  if((r.data||[]).length<1000)break;
 }
 rows.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 return new Response(transactionsCsv(rows),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="mybudget-transactions.csv"','Cache-Control':'private, no-store'}});
}
