import {createHash} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
export const ADMIN_LOGIN_ERROR='Email atau password salah atau akun tidak memiliki akses admin';
export const ADMIN_SESSION_SECONDS=8*60*60;
export async function loginAdmin(c:SupabaseClient,email:string,password:string){
 const fail=(status=401)=>({ok:false as const,status,error:ADMIN_LOGIN_ERROR});
 const identity=createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
 const attempt=await c.rpc('begin_admin_login',{p_identity_hash:identity});
 if(attempt.error)return fail(503);
 if(attempt.data?.allowed!==true)return fail(429);
 let accepted=false;
 let result:ReturnType<typeof fail>|{ok:true;token:string;maxAge:number}=fail();
 try{
  const login=await c.auth.signInWithPassword({email:email.trim().toLowerCase(),password});
  if(!login.error&&login.data.session){
   const role=await c.rpc('is_admin');
   const ttl=Math.min(ADMIN_SESSION_SECONDS,Math.max(0,(login.data.session.expires_at||0)-Math.floor(Date.now()/1000)));
   if(role.error)result=fail(503);
   else if(role.data===true&&ttl>0){
    const logged=await c.rpc('finish_admin_login',{p_attempt_id:attempt.data.attempt_id,p_success:true});
    if(logged.error)result=fail(503);
    else{accepted=true;result={ok:true,token:login.data.session.access_token,maxAge:ttl};}
   }
  }
 }finally{
  if(!accepted){
   try{const failed=await c.rpc('finish_admin_login',{p_attempt_id:attempt.data.attempt_id,p_success:false});if(failed.error)result=fail(503);}
   finally{await c.auth.signOut({scope:'local'});}
  }
 }
 return result;
}
