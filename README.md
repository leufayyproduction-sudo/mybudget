# My Budget — Phase 1

Website personal finance Indonesia. Source Phase 1: landing, Auth, onboarding, dashboard, CRUD transaksi/budget/target, pengaturan profil. Phase 2/3 belum dibuat; tidak ada pembayaran atau aktivasi premium.

## Jalankan
Node.js 22+, `npm ci`, lalu `npm run dev`. Buka http://localhost:3000. Tanpa environment Supabase, klik **Coba demo interaktif**. Data demo tersimpan di localStorage browser ini; bukan akun atau penyimpanan aman untuk data sensitif. Landing memakai data contoh berlabel dan tidak memasukkannya ke akun.

`npm run typecheck`, `npm test`, `npm run build`, `npm start`.

## Supabase
1. Buat proyek Supabase milikmu. Jalankan `supabase/migrations/001_phase1.sql` di SQL Editor (database baru).
2. Salin `.env.example` ke `.env.local`. Isi project URL dan anon/publishable-compatible key. Tidak ada service-role key yang dibutuhkan frontend.
3. Auth → URL Configuration: Site URL adalah origin aplikasi. Tambahkan localhost:3000 dan origin produksi sebagai allowed redirect URLs. Aktifkan konfirmasi email dan konfigurasi SMTP produksi sesuai kebijakan Supabase.
4. Restart dev server. Daftar, konfirmasi melalui email, lalu isi onboarding. Reset password memakai tautan ke origin yang sama; event PASSWORD_RECOVERY membuka form password baru.
5. Uji dua akun sungguhan: akun B tidak dapat membaca/update/delete row akun A melalui REST. Insert dengan user_id akun lain harus gagal. Uji kategori_id milik akun lain juga harus gagal (composite FK). Admin/premium belum tersedia di Phase 1.

### Mengisi environment dan memeriksa koneksi
`.env.local` dibuat dengan nilai kosong dan diabaikan git. Jangan commit file ini.
Isi `NEXT_PUBLIC_SUPABASE_URL=` dengan Project URL dari Supabase → Project Settings → API.
Isi `NEXT_PUBLIC_SUPABASE_ANON_KEY=` dengan anon/public key (atau publishable key) dari Project Settings → API Keys. Jangan memakai service_role/secret key.
Hentikan terminal dev dengan Ctrl+C, lalu `npm run dev`. Buka http://localhost:3000/setup dan klik Periksa koneksi. Environment dan Supabase Auth harus Berhasil. Setelah login, ulangi cek agar tabel profiles turut diperiksa. Untuk production, `npm run build` ulang sebelum `npm start` karena variabel NEXT_PUBLIC ditanam saat build.

RLS diberlakukan di semua tabel pribadi. Kategori awal memakai enum nama tetap; kategori custom belum diekspos UI. category_id opsional disediakan untuk pengembangan kategori; composite FK memvalidasi kepemilikan bila digunakan. Mutasi langsung ke Supabase tunduk pada constraint DB dan RLS, bukan hanya validasi browser. Profile disimpan sebagai JSON terstruktur; tidak ada role/paket di profil. Tidak memakai Supabase Storage di Phase 1.

## Definisi keuangan
- Saldo: saldo awal + seluruh pemasukan aktual − seluruh pengeluaran aktual.
- Ringkasan bulan: hanya transaksi bulan yang dipilih. Saldo tetap saldo seluruh pencatatan.
- Aman dibelanjakan: saldo − sisa budget wajib (minimal nol tiap kategori) − rencana alokasi target aktif bulan terpilih. Ini indikator rencana, bukan jaminan keamanan keuangan. Nilai negatif tetap terlihat.
- Progres target: catatan dana yang sudah dialokasikan dari saldo, bukan transaksi terpisah. Tidak mengurangi saldo dua kali. Target tercapai tidak lagi ikut alokasi rencana.
- Patokan: rata-rata tiga bulan kalender selesai sebelum bulan terpilih, termasuk nol pada bulan tanpa transaksi; berbeda dari perkiraan onboarding. Riwayat pendek dapat menghasilkan patokan rendah.
- Proyeksi target: pembulatan ke atas (target − terkumpul) / alokasi bulanan, tanpa bunga; alokasi nol tidak punya estimasi.

## Hosting
Belum live. Target domain mybudget.biz.id perlu akses DNS dan konfigurasi hosting.
Vercel Hobby hanya untuk penggunaan personal nonkomersial: https://vercel.com/docs/plans/hobby. Penawaran premium berbayar memerlukan paket/provider yang mengizinkan komersial. Gunakan `npm run build` + `npm start` pada host Node lain; tidak ada dependency khusus Vercel.

## Keterbatasan Phase 1
Tidak ada Reports, checkout, admin, CMS, premium, recurring, digital tools atau AI. Tidak meminta QRIS/PIN. Tidak ada batas jumlah transaksi/goals di Phase 1; batas Free dan penegakan entitlement ditetapkan Phase 2. Dark mode ditunda. Nominal saldo beranimasi ringan dengan reduced-motion; transaksi optimistic dengan rollback saat gagal, form mempertahankan isi saat error. Jangan mengklaim pembayaran/admin/premium teruji sebelum implementasinya ada.

Lihat PROGRESS.md untuk hasil verifikasi dan langkah berikutnya. Logo resmi terpusat di components/wordmark.tsx.

## Logo dan ulasan pengguna
Logo resmi dari pengguna ada di `public/brand/mybudget-logo.png`, dirender lewat Wordmark. `app/icon.png` memakai gambar asli yang sama untuk ikon tab, tanpa membuat ulang logo.
Jalankan `supabase/migrations/002_reviews.sql` setelah migration 001 untuk mengaktifkan ulasan. Landing memiliki bagian Ulasan; halaman `/reviews` bisa dibuka dari footer dashboard. Pengguna login dapat menulis satu ulasan per akun dan memperbaruinya. Nama tampilan dan teks menjadi publik setelah persetujuan pada form; jangan masukkan informasi keuangan pribadi. Rating 1–5, teks 10–1.000 karakter, nama 2–60 karakter divalidasi browser dan database.
RLS tabel reviews hanya memberi akses row milik sendiri. Public view sengaja memakai hak owner, memproyeksikan hanya nama tampilan, rating, teks, ID ulasan, dan tanggal; tidak mengeluarkan user_id/email/profil. RPC ringkasan hanya mengeluarkan agregat rating. Timestamp ditetapkan DB dan tidak dapat diset browser. Tidak ada label pembelian terverifikasi palsu. Daftar menampilkan 20 ulasan terbaru, rating ringkasan mencakup semuanya. Moderasi/rate limiting tambahan belum tersedia.
Tanpa Supabase, satu ulasan demo bisa diisi, diperbarui, dan dihapus, disimpan lokal dengan label eksplisit; tidak dihitung sebagai testimoni pengguna sungguhan. `/reviews?demo=1` menyediakan uji lokal terpisah bahkan ketika environment Supabase sudah terisi. Mode ini tidak mengubah data atau hak akses server. Integrasi ulasan Supabase/RLS masih memerlukan migration 002 dan pengujian dua akun.
