import { z } from 'zod';
const plain=(max:number)=>z.string().trim().max(max).refine(v=>!/[<>]/.test(v),'Gunakan teks biasa tanpa HTML.');
export const reviewSchema=z.object({display_name:plain(60).refine(v=>v.length>=2,'Nama minimal 2 karakter.'),rating:z.number().int().min(1,'Pilih rating 1–5 bintang.').max(5),body:plain(500).refine(v=>v.length>=10,'Ulasan minimal 10 karakter.')});
export type Review={id:string;display_name:string;rating:number;body:string;created_at:string;updated_at:string};
