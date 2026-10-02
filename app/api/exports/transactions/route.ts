import {authenticatedClient,apiError,privateJson} from '@/lib/server-api';
import {transactionsCsv} from '@/lib/finance/csv';
import type {Transaction} from '@/lib/finance';
export async function GET(request:Request){try{
 const c=await authenticatedClient(request);const e=await c.rpc('get_entitlement');
 if(e.error)return privateJson({error:'Hak ekspor belum dapat diperiksa.'},503);
 if(!['plus','pro'].includes(e.data.plan))return privateJson({error:'Ekspor CSV tersedia untuk Plus atau Pro aktif.'},403);
 // Verified user JWT, SECURITY INVOKER table access and existing owner RLS.
 const rows:Transaction[]=[];
 for(let offset=0;;offset+=1000){
  const r=await c.from('transactions').select('id,data').order('id').range(offset,offset+999);
  if(r.error)return privateJson({error:'Transaksi belum dapat diekspor.'},503);
  rows.push(...(r.data||[]).map(t=>({...t.data,id:t.id})) as Transaction[]);
  if((r.data||[]).length<1000)break;
 }
 rows.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 return new Response(transactionsCsv(rows),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="mybudget-transactions.csv"','Cache-Control':'private, no-store'}});
}catch(e){return apiError(e);}}
