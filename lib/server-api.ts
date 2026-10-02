// Imported only by route handlers. Public key + verified user's JWT; no service role.
import { createClient } from '@supabase/supabase-js';
export async function authenticatedClient(request: Request) {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key) throw new Error('CONFIGURATION');
 const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
 if(!token) throw new Error('UNAUTHENTICATED');
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{Authorization:`Bearer ${token}`},fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}});
 const r=await client.auth.getUser(token);
 if(r.error||!r.data.user) throw new Error('UNAUTHENTICATED');
 return client;
}
export function apiError(error: unknown) {
 const message=error instanceof Error?error.message:'';
 return Response.json({error:message==='UNAUTHENTICATED'?'Masuk untuk mengakses pesanan.':'Pesanan belum dapat diakses. Periksa koneksi atau konfigurasi Supabase.'},{status:message==='UNAUTHENTICATED'?401:503,headers:{'Cache-Control':'private, no-store'}});
}
export function privateJson(data: unknown,status=200) {return Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});}
