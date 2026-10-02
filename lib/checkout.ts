import { z } from 'zod';
export const createOrderSchema=z.object({product_code:z.string().regex(/^[a-z0-9_-]{2,60}$/),request_id:z.string().uuid()});
export const confirmationSchema=z.object({reference:z.string().trim().min(3).max(120),note:z.string().max(1000).default(''),proof_path:z.string().max(300).nullable().default(null)});
export const orderStatus={pending:'Menunggu pembayaran',submitted:'Menunggu verifikasi admin',paid:'Pembayaran terverifikasi',rejected:'Konfirmasi ditolak',expired:'Batas waktu berakhir'} as const;
export type Order={id:string;order_number:string;product_name:string;product_type:string;price_rupiah:number;unique_amount:number;total_rupiah:number;duration_days:number|null;plan:string|null;merchant_name:string;qris_path:string;payment_instructions:string;status:keyof typeof orderStatus;expires_at:string;created_at:string;review_note:string|null};
export function validateProof(file:{size:number;type:string}) {
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)) return 'Bukti harus berupa gambar JPG, PNG, atau WebP.';
 if(file.size===0||file.size>5*1024*1024) return 'Ukuran bukti harus lebih dari 0 dan maksimal 5 MB.';
 return null;
}
