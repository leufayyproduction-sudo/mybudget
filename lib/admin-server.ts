import { cookies } from 'next/headers';
import {redirect} from 'next/navigation';
import { authenticatedClient } from './server-api';
export {ADMIN_COOKIE} from './admin-cookie';
import {ADMIN_COOKIE} from './admin-cookie';
export function sameAdminOrigin(request:Request){try{const origin=new URL(request.headers.get('origin')||'');return ['http:','https:'].includes(origin.protocol)&&origin.host===(request.headers.get('host')||new URL(request.url).host);}catch{return false;}}
export async function adminToken(){return (await cookies()).get(ADMIN_COOKIE)?.value;}
export async function adminClient(request?:Request) {
 const token=await adminToken();
 if(request&&request.method!=='GET'&&!sameAdminOrigin(request))throw new Error('CSRF');
 const input=new Request(request?.url||'http://localhost',{headers:token?{Authorization:`Bearer ${token}`}:{}});
 const c=await authenticatedClient(input).catch(e=>{if(!request&&e.message==='UNAUTHENTICATED')redirect('/admin/login');throw e;});
 const role=await c.rpc('is_admin');
 if(role.error)throw new Error('CONFIGURATION');
 if(role.data!==true){if(!request)redirect('/admin/login');throw new Error('FORBIDDEN');}
 return c;
}
export function adminError(e:unknown){const message=e instanceof Error?e.message:'';if(['FORBIDDEN','UNAUTHENTICATED'].includes(message))return new Response(null,{status:303,headers:{Location:'/admin/login','Cache-Control':'private, no-store'}});return Response.json({error:message==='CSRF'?'Akses ditolak.':'Layanan admin belum tersedia. Periksa migration dan koneksi.'},{status:message==='CSRF'?403:503,headers:{'Cache-Control':'private, no-store'}});}
