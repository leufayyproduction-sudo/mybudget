export const ADMIN_COOKIE='mybudget_admin_session';
export function adminCookie(response:Response,token='',maxAge=0,secure=false){
 const flags=`; HttpOnly; SameSite=Strict${secure?'; Secure':''}`;
 // Explicit headers preserve both paths; a cookie jar keyed by name may drop one.
 response.headers.append('Set-Cookie',`${ADMIN_COOKIE}=; Max-Age=0; Path=/admin${flags}`);
 response.headers.append('Set-Cookie',`${ADMIN_COOKIE}=${encodeURIComponent(token)}; Max-Age=${maxAge}; Path=/${flags}`);
 response.headers.set('Cache-Control','private, no-store');
 return response;
}
