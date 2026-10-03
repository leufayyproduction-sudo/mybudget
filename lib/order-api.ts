import { supabase } from './supabase';
export async function orderApi(path:string,body?:unknown) {
 if(path.startsWith('/api/admin/')){
  const response=await fetch(path,{method:body?'POST':'GET',cache:'no-store',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
  if(response.redirected&&new URL(response.url).pathname==='/admin/login'){window.location.assign('/admin/login');throw new Error('Sesi admin berakhir. Masuk kembali.');}
  const result=await response.json();if(!response.ok)throw new Error(result.error||'Permintaan admin gagal.');return result;
 }
 if(!supabase)throw new Error('Supabase belum dikonfigurasi.');
 const {data:{session}}=await supabase.auth.getSession();
 if(!session)throw new Error('Masuk dengan akun Supabase untuk mengakses pesanan. Demo tidak membuat pesanan.');
 const response=await fetch(path,{method:body?'POST':'GET',cache:'no-store',headers:{Authorization:`Bearer ${session.access_token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
 const result=await response.json();if(!response.ok)throw new Error(result.error||'Permintaan gagal. Coba lagi.');return result;
}
