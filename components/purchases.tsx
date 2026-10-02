'use client';
import { useEffect,useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { orderApi } from '@/lib/order-api';
import { orderStatus,type Order } from '@/lib/checkout';
import { rupiah } from '@/lib/finance';
type Product={id:string;code:string;name:string;price_rupiah:number;duration_days:number|null;description:string;type:string};
type PaymentSetting={product_id:string|null};
export default function Purchases({user}:{user:string}) {
 const router=useRouter();
 const [products,setProducts]=useState<Product[]>([]),[settings,setSettings]=useState<PaymentSetting[]>([]),[orders,setOrders]=useState<Order[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let alive=true;async function load(){try{
  if(!supabase)return;
  const [catalog,payment]=await Promise.all([supabase.from('products').select('id,code,name,price_rupiah,duration_days,description,type').order('sort_order'),supabase.from('payment_settings').select('product_id')]);
  if(catalog.error||payment.error)throw new Error('Checkout belum dikonfigurasi. Terapkan migration 005.');
  const history=user==='demo'?{orders:[]}:await orderApi('/api/orders');
  if(alive){setProducts(catalog.data||[]);setSettings(payment.data||[]);setOrders(history.orders);}
 }catch(e){if(alive)setError((e as Error).message);}finally{if(alive)setLoading(false);}}void load();return()=>{alive=false;};},[user]);
 async function buy(code:string){setBusy(code);setError('');try{const r=await orderApi('/api/orders',{product_code:code,request_id:crypto.randomUUID()});router.push(`/checkout/${r.order.id}`);}catch(e){setError((e as Error).message);}finally{setBusy('');}}
 return <><section className="panel"><div className="section-heading"><div><h2>Pilih masa akses</h2><p>Harga final diambil dari katalog saat pesanan dibuat.</p></div></div>{loading&&<p role="status" className="muted">Memuat produk…</p>}{error&&<p className="form-error" role="alert">{error}</p>}{!loading&&!products.length&&!error&&<p className="muted">Belum ada produk aktif.</p>}<div className="purchase-list">{products.map(p=>{const available=settings.some(s=>s.product_id===null||s.product_id===p.id)&&p.type!=='digital_tool';return <div key={p.id}><div><strong>{p.name}</strong><p className="muted">{p.description}</p><small>{p.duration_days} hari setelah verifikasi pembayaran</small></div><div><strong className="money">{rupiah(p.price_rupiah)}</strong><button className="button primary" disabled={!!busy||!available||user==='demo'} onClick={()=>buy(p.code)}>{busy===p.code?'Membuat pesanan…':user==='demo'?'Masuk untuk membeli':available?'Lanjut ke checkout':'Pembayaran belum tersedia'}</button></div></div>;})}</div><p className="muted">QRIS resmi merchant harus dikonfigurasi lebih dahulu. Pembayaran diverifikasi manual, bukan otomatis. Demo tidak membuat pesanan.</p></section>
 <section className="panel"><div className="section-heading"><h2>Riwayat pembelian</h2></div>{!orders.length?<p className="muted">Belum ada pesanan. Produk yang bisa dibayar akan tersedia setelah QRIS merchant dikonfigurasi.</p>:<ol className="order-history">{orders.map(o=><li key={o.id}><div><strong>{o.product_name}</strong><small>{o.order_number} · {new Date(o.created_at).toLocaleDateString('id-ID')}</small></div><div><span className="pill">{orderStatus[o.status]}</span><strong className="money">{rupiah(o.total_rupiah)}</strong><Link className="text-button" href={`/checkout/${o.id}`}>Detail pesanan</Link></div></li>)}</ol>}</section></>;
}
