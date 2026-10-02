import Reviews from '@/components/reviews';
import Wordmark from '@/components/wordmark';
import Link from 'next/link';
export default async function ReviewsPage({searchParams}:{searchParams:Promise<{demo?:string}>}){const {demo}=await searchParams;return <main className="landing"><header><Link href="/" aria-label="My Budget beranda"><Wordmark/></Link><Link className="text-button" href="/">Kembali ke beranda</Link></header><Reviews demo={demo==='1'}/></main>;}
