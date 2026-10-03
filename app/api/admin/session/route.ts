import {sameAdminOrigin} from '@/lib/admin-server';
import {adminCookie} from '@/lib/admin-cookie';
export async function POST(request:Request){return Response.redirect(new URL('/admin/login',request.url),303);}
export async function DELETE(request:Request){
 if(!sameAdminOrigin(request))return new Response('Akses ditolak',{status:403});
 return adminCookie(Response.json({ok:true}));
}
