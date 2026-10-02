import {z} from 'zod';
export const productSchema=z.object({id:z.string().uuid().optional(),code:z.string().regex(/^[a-z0-9_-]{2,60}$/),name:z.string().trim().min(1).max(120),type:z.enum(['subscription','early_access','digital_tool']),price_rupiah:z.number().int().min(1).max(1e9),duration_days:z.number().int().min(1).max(3660).nullable(),plan:z.enum(['plus','pro']).nullable(),active:z.boolean(),sort_order:z.number().int().min(-1000).max(1000),description:z.string().max(1000),promo_starts_at:z.string().datetime().nullable(),promo_ends_at:z.string().datetime().nullable(),digital_file_path:z.string().max(250).nullable()}).refine(v=>v.type==='digital_tool'?v.plan===null:!!v.plan&&!!v.duration_days,{message:'Paket memerlukan plan dan durasi.'}).refine(v=>!v.promo_starts_at||!v.promo_ends_at||v.promo_starts_at<v.promo_ends_at,{message:'Periode promo tidak valid.'}).refine(v=>v.type!=='early_access'||!v.active||!!v.promo_starts_at&&!!v.promo_ends_at,{message:'Early Access aktif memerlukan periode promo.'}).refine(v=>v.type!=='digital_tool'||!v.active||!!v.digital_file_path,{message:'Produk digital aktif memerlukan file.'});
export const paymentSettingsSchema=z.object({id:z.string().uuid().optional(),product_id:z.string().uuid().nullable(),merchant_name:z.string().trim().min(1).max(120),qris_path:z.string().min(1).max(250),instructions:z.string().max(1000),enabled:z.boolean(),unique_amount_enabled:z.boolean()});
export function validUpload(bytes:Uint8Array,type:string,bucket:string){
 const image=['image/png','image/jpeg','image/webp'].includes(type);
 const limit=bucket==='digital-files'?20*1024*1024:bucket==='site-assets'?2*1024*1024:5*1024*1024;
 if(!bytes.length||bytes.length>limit)return false;
 if(bucket!=='digital-files'&&!image)return false;
 const text=new TextDecoder().decode(bytes.slice(0,12));
 if(type==='image/png')return bytes[0]===137&&text.slice(1,4)==='PNG'&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10;
 if(type==='image/jpeg')return bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(type==='image/webp')return text.startsWith('RIFF')&&text.slice(8,12)==='WEBP';
 if(type==='application/pdf')return text.startsWith('%PDF-');
 if(type==='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')return bytes[0]===80&&bytes[1]===75&&bytes[2]===3&&bytes[3]===4;
 if(type==='text/csv')return !bytes.includes(0)&&!new TextDecoder().decode(bytes.slice(0,256)).trimStart().startsWith('<');
 return false;
}
