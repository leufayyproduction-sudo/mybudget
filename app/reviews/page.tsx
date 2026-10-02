import Reviews from '@/components/reviews';
import Wordmark from '@/components/wordmark';
export default async function ReviewsPage({searchParams}:{searchParams:Promise<{demo?:string}>}){const {demo}=await searchParams;return <main className="landing"><header><a href="/" aria-label="My Budget beranda"><Wordmark/></a><a className="text-button" href="/">Kembali ke beranda</a></header><Reviews demo={demo==='1'}/></main>;}
