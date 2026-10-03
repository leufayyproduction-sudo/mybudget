import {adminClient} from '@/lib/admin-server';
import AdminPurchases from '@/components/admin-purchases';
export const dynamic='force-dynamic';
export default async function Page(){await adminClient();return <AdminPurchases/>;}
