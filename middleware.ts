import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
export async function middleware(request:NextRequest){
 if(request.nextUrl.pathname==='/admin/connect')return NextResponse.next();
 if(!request.cookies.get('mybudget_admin_session'))return NextResponse.redirect(new URL('/admin/connect',request.url));
 const token=request.cookies.get('mybudget_admin_session')!.value;
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)return new NextResponse('Admin belum dikonfigurasi.',{status:503});
 const c=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
 const auth=await c.auth.getUser(token);
 if(auth.error||!auth.data.user)return NextResponse.redirect(new URL('/admin/connect',request.url));
 const role=await c.rpc('is_admin');
 if(role.error||role.data!==true)return new NextResponse('Akses admin ditolak.',{status:role.error?503:403,headers:{'Cache-Control':'private, no-store'}});
 return NextResponse.next();
}
export const config={matcher:['/admin/:path*']};
