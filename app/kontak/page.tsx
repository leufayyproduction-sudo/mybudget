import Link from 'next/link';
import {MessageCircle,Clock} from 'lucide-react';
import Wordmark from '@/components/wordmark';
import {getPublicSite} from '@/lib/site-server';
import {whatsappLink} from '@/lib/support';
export const dynamic='force-dynamic';
const questions=[
 ['Saya sudah bayar, tapi paket belum aktif. Kenapa?','Pembayaran diperiksa manual oleh admin dengan mencocokkan transaksi yang masuk. Setelah dikonfirmasi, paket aktif otomatis. Pemeriksaan ditargetkan paling lambat 1x24 jam. Pastikan Anda sudah mengirim referensi transaksi di halaman pesanan. Jika lewat dari itu, hubungi kami dengan ID pesanan Anda.'],
 ['Bagaimana cara membayar?','Pilih paket, buka halaman pembayaran, scan QRIS yang tampil, dan masukkan nominal tepat sama dengan total di halaman itu karena QRIS ini tidak mengisi nominal otomatis. Setelah membayar, kirim konfirmasi beserta referensi transaksi.'],
 ['Email konfirmasi atau reset password tidak masuk.','Cek folder spam atau promosi, tunggu beberapa menit, pastikan alamat email benar. Jika masih belum masuk, hubungi kami lewat WhatsApp.'],
 ['Apakah data keuangan saya aman?','Data setiap akun dipisahkan dan hanya bisa dibuka pemilik akun. Admin hanya melihat data pembelian dan pengelolaan produk, bukan transaksi pribadi Anda.'],
 ['Berapa lama paket berlaku dan bagaimana memperpanjang?','Plus dan Pro berlaku 30 hari sejak diaktifkan. Pesan paket yang sama sebelum masa berlaku habis, dan masa berlakunya ditambahkan setelah masa aktif saat ini berakhir.'],
];
export default async function Page(){const {content}=await getPublicSite();return <main className="contact-page"><header><Wordmark/><Link href="/">Kembali ke My Budget</Link></header><section className="contact-intro"><span className="eyebrow">KONTAK & BANTUAN</span><h1>Butuh bantuan?</h1><p>Kalau ada yang membingungkan atau terkendala, hubungi kami lewat WhatsApp. Kami bantu satu per satu.</p><p>Hubungi kami untuk: kendala masuk akun atau email konfirmasi; pembayaran dan status pesanan; paket yang belum aktif; pertanyaan tentang fitur.</p><p className="contact-hours"><Clock size={18}/><span>Jam layanan: {content.support.hours}</span></p><a className="button primary" href={whatsappLink(content.support)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><MessageCircle size={20}/>Hubungi via WhatsApp</a><p className="muted">Tim My Budget tidak pernah meminta password, PIN DANA, atau kode OTP lewat WhatsApp. Jangan berikan data itu kepada siapa pun. Tautan menyiapkan pesan awal; Anda sendiri yang menekan kirim.</p></section><section className="contact-faq"><h2>Pertanyaan umum</h2>{questions.map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</section></main>;}
