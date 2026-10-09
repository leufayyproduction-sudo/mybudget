import {cache} from 'react';
import {createClient} from '@supabase/supabase-js';
import {defaultContent,siteContentSchema,type PublicProduct} from './site-content';
export const getPublicSite=cache(async()=>{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)return {content:defaultContent,products:[] as PublicProduct[]};
 try{const c=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,cache:'no-store',signal:AbortSignal.timeout(5000)})}});const [published,catalog]=await Promise.all([c.from('site_content_published').select('content').eq('id',1).maybeSingle(),c.from('products').select('id,code,name,type,price_rupiah,duration_days,description').eq('active',true).gt('price_rupiah',0).order('sort_order')]);const content=siteContentSchema.safeParse(published.data?.content);return {content:content.success?content.data:defaultContent,products:(!catalog.error?catalog.data||[]:[]) as PublicProduct[]};}catch{return {content:defaultContent,products:[] as PublicProduct[]};}
});
