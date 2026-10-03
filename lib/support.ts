import {z} from 'zod';
export const supportSchema=z.object({phone:z.string().regex(/^62[1-9][0-9]{7,12}$/,'Gunakan nomor 62xxxxxxxxxx, tanpa +, spasi, atau tanda hubung.'),message:z.string().trim().min(1).max(300),hours:z.string().trim().min(1).max(120)}).strict();
export const defaultSupport={phone:'6288806001355',message:'Halo My Budget, saya membutuhkan bantuan.',hours:'Jam balasan belum ditetapkan.'};
export type Support=z.infer<typeof supportSchema>;
export function whatsappLink(config:Support,order?:{order_number:string;product_name:string}){
 const valid=supportSchema.parse(config);
 const message=valid.message+(order?`\nID pesanan: ${order.order_number.slice(0,80)}\nProduk: ${order.product_name.slice(0,160)}`:'');
 const url=new URL(`https://wa.me/${valid.phone}`);url.searchParams.set('text',message);return url.toString();
}
