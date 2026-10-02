import { supabase } from './supabase';
import { z } from 'zod';
export const entitlementSchema = z.object({
 plan: z.enum(['free','plus','pro']), name: z.string(), status: z.enum(['free','active']),
 expires_at: z.string().nullable(), reports_access: z.boolean(),
 transactions_limit: z.number().int().positive().nullable(), categories_limit: z.number().int().positive().nullable(),
 goals_limit: z.number().int().positive().nullable(), budgets_limit: z.number().int().positive().nullable(),
});
export type Entitlement = z.infer<typeof entitlementSchema>;
export async function getEntitlement(): Promise<Entitlement> {
 if (!supabase) throw new Error('Supabase belum dikonfigurasi.');
 const r = await supabase.rpc('get_entitlement');
 if (r.error) throw new Error('Paket belum dapat diperiksa. Pastikan migration 004 sudah diterapkan, lalu coba lagi.');
 return entitlementSchema.parse(r.data);
}
