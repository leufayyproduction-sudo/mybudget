import { cookies } from 'next/headers';
import { authenticatedClient } from './server-api';
export const ADMIN_COOKIE='mybudget_admin_session';
export async function adminClient(request?:Request) {
 let input=request;
 if(!input){const token=(await cookies()).get(ADMIN_COOKIE)?.value;input=new Request('http://localhost',{headers:token?{Authorization:`Bearer ${token}`}:{}});}
 const c=await authenticatedClient(input);
 const role=await c.rpc('is_admin');
 if(role.error)throw new Error('CONFIGURATION');
 if(role.data!==true)throw new Error('FORBIDDEN');
 return c;
}
export function adminError(e:unknown){const message=e instanceof Error?e.message:'';return Response.json({error:message==='FORBIDDEN'?'Akses ditolak. Akun ini bukan admin.':message==='UNAUTHENTICATED'?'Sesi admin berakhir. Masuk kembali.':'Layanan admin belum tersedia. Periksa migration dan koneksi.'},{status:message==='FORBIDDEN'?403:message==='UNAUTHENTICATED'?401:503,headers:{'Cache-Control':'private, no-store'}});}
