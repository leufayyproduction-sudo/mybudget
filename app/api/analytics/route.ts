import {authenticatedClient,privateJson,apiError} from '@/lib/server-api';
import {financialHealth} from '@/lib/finance/analytics';
import {cashForecast} from '@/lib/finance/forecast';
import type {AnalyticsData} from '@/lib/finance/analytics';
export async function GET(request:Request){try{
 const client=await authenticatedClient(request);const r=await client.rpc('get_pro_analytics');
 if(r.error)return privateJson({error:r.error.code==='42501'?'Pro aktif diperlukan.':'Terapkan migration 009 lalu coba lagi.'},r.error.code==='42501'?403:503);
 const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Jakarta'}).format(new Date());
 return privateJson({health:financialHealth(r.data as AnalyticsData,date),forecast:cashForecast(r.data as AnalyticsData,date),date});
}catch(e){return apiError(e);}}
