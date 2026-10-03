import {createClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {sameAdminOrigin} from '@/lib/admin-server';
import {adminCookie} from '@/lib/admin-cookie';
import {loginAdmin,ADMIN_LOGIN_ERROR} from '@/lib/admin-login';
import {privateJson} from '@/lib/server-api';
export async function POST(request:Request){
 if(!sameAdminOrigin(request))return privateJson({error:ADMIN_LOGIN_ERROR},403);
 const denied=(status=401)=>adminCookie(privateJson({error:ADMIN_LOGIN_ERROR},status));
 try{
  if(Number(request.headers.get('content-length'))>4096)return denied();
  const body=z.object({email:z.string().trim().email().max(254),password:z.string().min(1).max(1024)}).strict().safeParse(await request.json());
  if(!body.success)return denied();
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)return denied(503);
  const c=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}});
  const result=await loginAdmin(c,body.data.email,body.data.password);
  if(!result.ok){const response=denied(result.status);if(result.status===429)response.headers.set('Retry-After','900');return response;}
  return adminCookie(privateJson({ok:true,redirect:'/admin'}),result.token,result.maxAge,new URL(request.headers.get('origin')!).protocol==='https:');
 }catch{return denied(503);}
}
