import { z } from 'zod';
export const reviewSchema=z.object({display_name:z.string().trim().min(2,'Nama minimal 2 karakter.').max(60,'Nama maksimal 60 karakter.'),rating:z.number().int().min(1,'Pilih rating 1–5 bintang.').max(5),body:z.string().trim().min(10,'Ulasan minimal 10 karakter.').max(1000,'Ulasan maksimal 1.000 karakter.')});
export type Review={id:string;display_name:string;rating:number;body:string;created_at:string;updated_at:string};
