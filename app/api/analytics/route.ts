import {authenticatedClient,privateJson,apiError} from '@/lib/server-api';
import {financialHealth} from '@/lib/finance/analytics';
import {cashForecast,type ForecastRule} from '@/lib/finance/forecast';
import {allocationCapacity,goalProjection} from '@/lib/finance/projection';
import {z} from 'zod';
import type {AnalyticsData} from '@/lib/finance/analytics';
export async function GET(request:Request){try{
 const client=await authenticatedClient(request);let r=await client.rpc('get_forecast_analytics');const forecastReady=r.error?.code!=='PGRST202';if(!forecastReady)r=await client.rpc('get_pro_analytics');
 if(r.error)return privateJson({error:r.error.code==='42501'?'Pro aktif diperlukan.':'Terapkan migration 009 lalu coba lagi.'},r.error.code==='42501'?403:503);
 const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Jakarta'}).format(new Date());
 const data=r.data as AnalyticsData&{recurring?:ForecastRule[]};
 return privateJson({health:financialHealth(data,date),forecast:forecastReady?cashForecast(data,date,data.recurring||[]):null,forecastReady,projection:goalProjection(data.goals,date,allocationCapacity(data,date)),date});
}catch(e){return apiError(e);}}
export async function POST(request:Request){try{
 const client=await authenticatedClient(request);
 const parsed=z.object({goal_id:z.string().uuid(),allocation:z.number().int().min(0).max(1e12)}).strict().safeParse(await request.json());
 if(!parsed.success)return privateJson({error:'Nominal alokasi atau target tidak valid.'},400);
 const r=await client.rpc('set_projected_allocation',parsed.data);
 if(r.error)return privateJson({error:r.error.code==='42501'?'Pro aktif dan kepemilikan target diperlukan.':'Alokasi belum dapat disimpan.'},r.error.code==='42501'?403:400);
 return privateJson({saved:true});
}catch(e){return apiError(e);}}
