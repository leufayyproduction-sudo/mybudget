import { authenticatedClient,apiError,privateJson } from '@/lib/server-api';
import { createOrderSchema } from '@/lib/checkout';
export async function GET(request: Request) {
 try {const c=await authenticatedClient(request);const r=await c.rpc('list_my_orders');if(r.error)return privateJson({error:'Riwayat pesanan belum tersedia. Terapkan migration 005.'},503);return privateJson({orders:r.data||[]});}catch(e){return apiError(e);}
}
export async function POST(request: Request) {
 try {const c=await authenticatedClient(request);let body:unknown;try{body=await request.json();}catch{return privateJson({error:'Format permintaan tidak valid.'},400);}
  // zod strips extra fields, including any browser-supplied price/plan/user_id.
  const v=createOrderSchema.safeParse(body);if(!v.success)return privateJson({error:'Pilih produk yang valid.'},400);
  const product=await c.from('products').select('price_rupiah').eq('code',v.data.product_code).eq('active',true).maybeSingle();
  if(product.error||!product.data||product.data.price_rupiah<=0)return privateJson({error:'Pilih produk berbayar yang tersedia. Free otomatis diberikan saat daftar.'},400);
  const r=await c.rpc('create_order',{p_product_code:v.data.product_code,p_request_id:v.data.request_id});
  if(r.error)return privateJson({error:['22023','42501'].includes(r.error.code)?r.error.message:'Pesanan belum dapat dibuat. Periksa konfigurasi produk dan QRIS.'},r.error.code==='42501'?403:400);
  return privateJson({order:r.data},201);
 }catch(e){return apiError(e);}
}
