import {z} from 'zod';
export const supportSchema=z.object({phone:z.string().regex(/^62[1-9][0-9]{7,12}$/,'Gunakan nomor 62xxxxxxxxxx, tanpa +, spasi, atau tanda hubung.'),message:z.string().trim().min(1).max(300),hours:z.string().trim().min(1).max(120)}).strict();
export const defaultSupport={phone:'6288806001355',message:'Halo My Budget, saya butuh bantuan.',hours:'Setiap hari, 08.00-21.00 WIB. Pesan di luar jam itu dibalas paling lambat 1x24 jam'};
export type Support=z.infer<typeof supportSchema>;
export function whatsappLink(config:Support,order?:{order_number:string;product_name:string}){
 const valid=supportSchema.parse(config);
 const template=order&&!/\{ID_PESANAN\}|\{NAMA_PRODUK\}/.test(valid.message)?`${valid.message.replace(/[.!?]+$/,'')} untuk pesanan {ID_PESANAN} ({NAMA_PRODUK}).`:valid.message;
 const message=order?template.replace(/\{ID_PESANAN\}|\{NAMA_PRODUK\}/g,key=>key==='{ID_PESANAN}'?order.order_number.slice(0,80):order.product_name.slice(0,160)):template;
 const url=new URL(`https://wa.me/${valid.phone}`);url.searchParams.set('text',message);return url.toString();
}
