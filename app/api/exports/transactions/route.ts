import {authenticatedClient,apiError} from '@/lib/server-api';
import {premiumExport} from '@/lib/premium-export';
export async function GET(request:Request){try{
 const response=await premiumExport(await authenticatedClient(request));
 response.headers.set('Cache-Control','private, no-store');
 return response;
}catch(e){return apiError(e);}}
