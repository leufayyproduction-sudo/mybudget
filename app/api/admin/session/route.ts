import {cookies} from 'next/headers';
import {adminClient,adminError,ADMIN_COOKIE} from '@/lib/admin-server';
export async function POST(request:Request){try{
 if(request.headers.get('origin')!==new URL(request.url).origin)return new Response('Akses ditolak',{status:403});
 await adminClient(request);
 const token=request.headers.get('authorization')!.slice(7);
 // Short-lived access token only. No refresh token is stored in the cookie.
 (await cookies()).set(ADMIN_COOKIE,token,{httpOnly:true,secure:new URL(request.url).protocol==='https:',sameSite:'strict',path:'/admin',maxAge:1800});
 return Response.json({ok:true},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return adminError(e);}}
export async function DELETE(request:Request){if(request.headers.get('origin')!==new URL(request.url).origin)return new Response('Akses ditolak',{status:403});(await cookies()).set(ADMIN_COOKIE,'',{httpOnly:true,path:'/admin',maxAge:0});return Response.json({ok:true});}
