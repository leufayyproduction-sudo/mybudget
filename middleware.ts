import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
export async function middleware(request:NextRequest){
 const path=request.nextUrl.pathname;
 if(path==='/admin/login'||path==='/api/admin/login'||(path==='/api/admin/session'&&request.method==='DELETE'))return NextResponse.next();
 if(path==='/admin/connect')return NextResponse.redirect(new URL('/admin/login',request.url));
 if(!request.cookies.get('mybudget_admin_session'))return NextResponse.redirect(new URL('/admin/login',request.url));
 const token=request.cookies.get('mybudget_admin_session')!.value;
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)return new NextResponse('Admin belum dikonfigurasi.',{status:503});
 const c=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`},fetch:(input,init)=>fetch(input,{...init,cache:'no-store',signal:AbortSignal.timeout(15000)})}});
 const auth=await c.auth.getUser(token);
 if(auth.error||!auth.data.user)return NextResponse.redirect(new URL('/admin/login',request.url));
 const role=await c.rpc('is_admin');
 if(role.error)return new NextResponse('Admin belum tersedia.',{status:503,headers:{'Cache-Control':'private, no-store'}});
 if(role.data!==true)return NextResponse.redirect(new URL('/admin/login',request.url));
 return NextResponse.next();
}
export const config={matcher:['/admin/:path*','/api/admin/:path*']};
