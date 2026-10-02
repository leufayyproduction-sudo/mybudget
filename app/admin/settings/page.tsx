import {adminClient} from '@/lib/admin-server';
import AdminSettings from '@/components/admin-settings';
export const dynamic='force-dynamic';
export default async function Page(){await adminClient();return <AdminSettings/>;}
