import {redirect} from 'next/navigation';
import Link from 'next/link';
import {adminClient} from '@/lib/admin-server';
import AdminPurchases from '@/components/admin-purchases';
export const dynamic='force-dynamic';
export default async function Page(){try{await adminClient();}catch(e){if((e as Error).message==='UNAUTHENTICATED')redirect('/admin/connect');return <main className="admin-connect"><h1>Akses ditolak</h1><p>Akun ini tidak memiliki akses admin atau layanan belum dikonfigurasi.</p><Link href="/">Kembali ke My Budget</Link></main>;}return <AdminPurchases/>;}
