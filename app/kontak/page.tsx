import Link from 'next/link';
import {MessageCircle,Clock} from 'lucide-react';
import Wordmark from '@/components/wordmark';
import {getPublicSite} from '@/lib/site-server';
import {whatsappLink} from '@/lib/support';
export const dynamic='force-dynamic';
const questions=[
 ['Saya tidak bisa login. Apa yang perlu dicek?','Pastikan email benar dan sudah dikonfirmasi. Gunakan reset password di halaman masuk. Jika masih terkendala, hubungi bantuan tanpa mengirim password atau kode OTP.'],
 ['Sudah membayar, mengapa paket belum aktif?','Pembayaran diverifikasi manual. Kirim konfirmasi di checkout, lalu lihat status pesanan. Mengirim bukti tidak langsung mengaktifkan paket.'],
 ['Apa yang perlu dikirim untuk kendala pesanan?','Cukup ID pesanan dan nama produk agar admin dapat memeriksa. Jangan kirim PIN, password, OTP, atau rincian keuangan pribadi.'],
 ['Mengapa fitur Premium terkunci lagi?','Periksa paket aktif dan masa berlakunya di halaman Paket. Setelah paket berakhir, data tetap tersimpan. Hubungi bantuan jika pesanan sudah disetujui tetapi akses belum sesuai.'],
 ['Apakah bantuan WhatsApp terhubung ke rekening saya?','Tidak. Tautan hanya membuka WhatsApp dengan pesan awal. Kamu sendiri yang memilih mengirim pesan; My Budget tidak mengirim transaksi atau data akun secara otomatis.'],
];
export default async function Page(){const {content}=await getPublicSite();return <main className="contact-page"><header><Wordmark/><Link href="/">Kembali ke My Budget</Link></header><section className="contact-intro"><span className="eyebrow">KONTAK & BANTUAN</span><h1>Ada kendala? Kami bantu.</h1><p>Hubungi kami jika kamu mengalami kendala login, pembayaran, atau akses paket.</p><p className="contact-hours"><Clock size={18}/><span>Jam balasan: {content.support.hours}</span></p><a className="button primary" href={whatsappLink(content.support)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><MessageCircle size={20}/>Hubungi via WhatsApp</a><p className="muted">Tautan menyiapkan pesan awal. Kamu sendiri yang menekan kirim. Jangan bagikan password, PIN, atau OTP.</p></section><section className="contact-faq"><h2>Pertanyaan umum</h2>{questions.map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</section></main>;}
