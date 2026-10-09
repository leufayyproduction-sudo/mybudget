import {adminClient,adminError} from '@/lib/admin-server';
import {privateJson} from '@/lib/server-api';
import {z} from 'zod';
export async function GET(request:Request){try{const c=await adminClient(request);const r=await c.from('reviews').select('*').order('created_at',{ascending:false}).limit(100);if(r.error)return privateJson({error:'Ulasan belum tersedia.'},503);return privateJson({reviews:r.data});}catch(e){return adminError(e);}}
export async function POST(request:Request){try{const c=await adminClient(request);const v=z.object({id:z.string().uuid(),action:z.enum(['approved','hidden','delete'])}).safeParse(await request.json());if(!v.success)return privateJson({error:'Aksi tidak valid.'},400);const r=await c.rpc('moderate_review',{p_id:v.data.id,p_action:v.data.action});if(r.error)return privateJson({error:'Moderasi gagal. Ulasan harus terhubung ke pesanan paid untuk disetujui.'},400);return privateJson({ok:true});}catch(e){return adminError(e);}}
