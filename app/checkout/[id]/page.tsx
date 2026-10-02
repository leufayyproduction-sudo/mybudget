import Link from 'next/link';
import Checkout from '@/components/checkout';
import Wordmark from '@/components/wordmark';
export default async function CheckoutPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <main className="checkout-shell"><header><Wordmark/><Link className="text-button" href="/">Kembali ke My Budget</Link></header><Checkout id={id}/></main>;}
