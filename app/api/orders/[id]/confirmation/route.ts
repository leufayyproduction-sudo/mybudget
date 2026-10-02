import { authenticatedClient,apiError,privateJson } from '@/lib/server-api';
import { confirmationSchema } from '@/lib/checkout';
import { z } from 'zod';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
 try {const c=await authenticatedClient(request);const {id}=await params;if(!z.string().uuid().safeParse(id).success)return privateJson({error:'Pesanan tidak valid.'},400);
  let body:unknown;try{body=await request.json();}catch{return privateJson({error:'Format konfirmasi tidak valid.'},400);}
  const v=confirmationSchema.safeParse(body);if(!v.success)return privateJson({error:'Isi referensi 3–120 karakter dan catatan maksimal 1.000 karakter.'},400);
  const r=await c.rpc('submit_payment_confirmation',{p_order_id:id,p_reference:v.data.reference,p_note:v.data.note,p_proof_path:v.data.proof_path});
  if(r.error)return privateJson({error:['22023','42501'].includes(r.error.code)?r.error.message:'Konfirmasi belum dapat disimpan.'},r.error.code==='42501'?403:400);
  return privateJson({order:r.data});
 }catch(e){return apiError(e);}
}
