import BudgetApp from '@/components/budget-app';
import {getPublicSite} from '@/lib/site-server';
export const dynamic='force-dynamic';
export default async function Page() {const site=await getPublicSite();return <BudgetApp site={site}/>;}
