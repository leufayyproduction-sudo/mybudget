import { supabase } from './supabase';
import { type Profile, type Transaction, type Budget, type Goal } from './finance';
export type Data = { profile: Profile | null; transactions: Transaction[]; budgets: Budget[]; goals: Goal[] };
export const empty: Data = { profile:null,transactions:[],budgets:[],goals:[] };
export const categories = ['Makan & minum','Transportasi','Belanja','Tagihan','Kesehatan','Hiburan','Lainnya','Project','Gaji'];
export async function loadData(user: string): Promise<Data> {
 if(!supabase) return JSON.parse(localStorage.getItem('mybudget-demo') || JSON.stringify(empty));
 const results=await Promise.all(['profiles','transactions','budgets','goals'].map(table=>supabase!.from(table).select('*').eq('user_id',user)));
 for(const r of results) if(r.error) throw r.error;
 return {profile:results[0].data?.[0]?.data || null,transactions:(results[1].data||[]).map(r=>({...r.data,id:r.id})),budgets:(results[2].data||[]).map(r=>({...r.data,id:r.id})),goals:(results[3].data||[]).map(r=>({...r.data,id:r.id}))};
}
export async function saveItem(user:string,table:'profiles'|'transactions'|'budgets'|'goals',item:Profile|Transaction|Budget|Goal) {
 if(!supabase) return;
 const row=table==='profiles'?{user_id:user,data:item}:{id:(item as Transaction).id,user_id:user,data:item};
 const {error}=await supabase.from(table).upsert(row);if(error)throw error;
}
export async function deleteItem(user:string,table:string,id:string){if(!supabase)return;const {error}=await supabase.from(table).delete().eq('id',id).eq('user_id',user);if(error)throw error;}
