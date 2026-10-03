import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {SupabaseClient} from '@supabase/supabase-js';
import {NextRequest} from 'next/server';
import {middleware} from '../middleware';
import {loginAdmin,ADMIN_LOGIN_ERROR,ADMIN_SESSION_SECONDS} from '../lib/admin-login';
import {adminCookie} from '../lib/admin-cookie';
function client({admin=false,passwordCorrect=true,allowed=true,audit=true}={}){
 const calls:{rpc:string;success?:boolean}[]=[],state={signout:0,auth:0};
 const c={rpc:async(name:string,p?:{p_success?:boolean})=>{calls.push({rpc:name,success:p?.p_success});return {error:name==='finish_admin_login'&&!audit?{}:null,data:name==='begin_admin_login'?{allowed,attempt_id:'attempt'}:name==='is_admin'?admin:null};},auth:{signInWithPassword:async()=>{state.auth++;return {error:passwordCorrect?null:{},data:{session:passwordCorrect?{access_token:'test-token',expires_at:Math.floor(Date.now()/1000)+99999}:null}};},signOut:async()=>{state.signout++;return {};}}};
 return {c:c as unknown as SupabaseClient,calls,state};
}
test('wrong password and non-admin have identical errors, log failure and sign out',async()=>{
 const ordinary=client(),wrong=client({passwordCorrect:false});
 const a=await loginAdmin(ordinary.c,'user@example.invalid','unused'),b=await loginAdmin(wrong.c,'user@example.invalid','unused');
 assert.deepEqual(a,b);assert.deepEqual(a,{ok:false,status:401,error:ADMIN_LOGIN_ERROR});
 for(const f of [ordinary,wrong]){assert.equal(f.state.signout,1);assert.ok(f.calls.some(c=>c.rpc==='finish_admin_login'&&c.success===false));assert.ok(!f.calls.some(c=>c.success===true));}
});
test('admin requires database role and successful audit; token stays server-side',async()=>{
 const f=client({admin:true});const result=await loginAdmin(f.c,'admin@example.invalid','unused');assert.equal(result.ok,true);
 if(result.ok){assert.equal(result.token,'test-token');assert.equal(result.maxAge,ADMIN_SESSION_SECONDS);}
 assert.equal(f.state.signout,0);assert.ok(f.calls.some(c=>c.rpc==='is_admin'));assert.ok(f.calls.some(c=>c.success===true));
 const broken=client({admin:true,audit:false});assert.equal((await loginAdmin(broken.c,'a@example.invalid','unused')).ok,false);assert.equal(broken.state.signout,1);
});
test('database rate limit rejects before Supabase password request',async()=>{const f=client({allowed:false});assert.deepEqual(await loginAdmin(f.c,'a@example.invalid','unused'),{ok:false,status:429,error:ADMIN_LOGIN_ERROR});assert.equal(f.state.auth,0);});
test('cookie is HttpOnly/Strict, root path for APIs, expires legacy path and clears logout',()=>{
 const r=adminCookie(new Response(), 'token',3600,true);const headers=r.headers.getSetCookie();assert.equal(headers.length,2);assert.match(headers[0],/Max-Age=0; Path=\/admin/);assert.match(headers[1],/Path=\/; HttpOnly; SameSite=Strict; Secure/);assert.equal(adminCookie(new Response()).headers.getSetCookie().filter(h=>h.includes('Max-Age=0')).length,2);
});
test('admin pages/API without session redirect to admin login; connect redirects',async()=>{
 for(const path of ['/admin','/admin/settings','/admin/content/preview','/api/admin/purchases','/admin/connect']){const r=await middleware(new NextRequest('http://localhost'+path));assert.equal(r.status,307);assert.equal(new URL(r.headers.get('location')!).pathname,'/admin/login');}
 assert.equal((await middleware(new NextRequest('http://localhost/admin/login'))).status,200);
});
