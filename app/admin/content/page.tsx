import {adminClient} from '@/lib/admin-server';import AdminContent from '@/components/admin-content';
export const dynamic='force-dynamic';
export default async function Page(){await adminClient();return <AdminContent/>;}
