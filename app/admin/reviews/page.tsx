import {adminClient} from '@/lib/admin-server';
import AdminReviews from '@/components/admin-reviews';
export const dynamic='force-dynamic';
export default async function Page(){await adminClient();return <AdminReviews/>;}
