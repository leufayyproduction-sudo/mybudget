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

### Hosting untuk penggunaan komersial
Vercel Hobby bukan pilihan untuk menawarkan paket atau tools berbayar. Sebelum peluncuran komersial, ganti paket hosting ke paket yang mengizinkan komersial, atau pindahkan aplikasi ke host Node.js yang sesuai. Periksa ketentuan dan biaya provider saat memilih; tidak ada jaminan operasional bisnis gratis.
Proyek memakai Next.js standar, bukan Vercel KV/Blob/Cron/Edge khusus. Build dengan `npm ci` dan `npm run build`, lalu jalankan `npm start` (PORT dapat ditentukan host). Saat pindah, atur dua environment Supabase di host baru, pindahkan DNS mybudget.biz.id, aktifkan HTTPS, serta ubah Supabase Site URL/allowed redirect URLs. Database/Auth tetap di Supabase sehingga tidak perlu memindahkan data hanya karena host aplikasi berubah. Storage privat dan konfigurasi merchant tetap perlu dibuat ketika slice terkait tersedia. Tidak ada deploy produksi atau konfigurasi deploy yang dibuat dalam sesi ini.

## Prasyarat Phase 2: verifikasi Phase 1 live
Phase 2 Sesi A tidak boleh dimulai sebelum isolasi dua akun Supabase sungguhan lolos. Unit test saja tidak membuktikan RLS. Hasil terbaru ada di `docs/phase1-rls-result.json`.
1. Jalankan migration 001 pada Supabase proyek uji. Jangan menjalankan ulang migration pada database yang sudah berisi tabel tersebut.
2. Daftarkan **dua akun khusus pengujian** lewat aplikasi. Konfirmasi email keduanya. Jangan onboarding dan jangan masukkan data keuangan pribadi. Skrip menolak akun yang sudah memiliki profile agar tidak mengubah profile lama.
3. Buka `.env.rls-test` yang sudah dibuat dan diabaikan git. Isi `RLS_TEST_A_EMAIL`, `RLS_TEST_A_PASSWORD`, `RLS_TEST_B_EMAIL`, `RLS_TEST_B_PASSWORD`. Isi `RLS_TEST_ALLOW_FIXTURES=dedicated-test-accounts` untuk menyatakan keduanya akun uji khusus yang boleh diberi fixture sementara. Jangan mengirim kredensial ke chat. Dua variabel public Supabase tetap di `.env.local`; service_role/secret key tidak diizinkan.
4. Jalankan `npm run verify:phase1-rls`. Skrip login sebagai A dan B, menguji baca/update/delete/insert lintas akun pada profiles/categories/transactions/budgets/goals dua arah, menguji FK kategori lintas akun serta validasi nominal/tanggal di database. Fixture dibuat hanya pada akun uji dan dihapus lewat pemiliknya di akhir; tidak menghapus akun Auth.
5. Status `passed` dan cleanup `passed` diperlukan untuk melanjutkan. `blocked` berarti verifikasi belum selesai; `failed` berarti cek tidak lolos. Laporan hanya memuat label hasil, tanpa token, email, password, user_id, atau data pribadi. Kegagalan cleanup perlu ditangani sebelum uji diulang.
Kasus tepi finance: `npm test`. Sesi A berikutnya: Reports → produk/entitlement → checkout manual. Sesi B terpisah: admin → QRIS/produk → CMS → verifikasi lanjutan. Tidak memulai Phase 3.

## Keterbatasan Phase 1
Tidak ada Reports, checkout, admin, CMS, premium, recurring, digital tools atau AI. Tidak meminta QRIS/PIN. Tidak ada batas jumlah transaksi/goals di Phase 1; batas Free dan penegakan entitlement ditetapkan Phase 2. Dark mode ditunda. Nominal saldo beranimasi ringan dengan reduced-motion; transaksi optimistic dengan rollback saat gagal, form mempertahankan isi saat error. Jangan mengklaim pembayaran/admin/premium teruji sebelum implementasinya ada.

Lihat PROGRESS.md untuk hasil verifikasi dan langkah berikutnya. Logo resmi terpusat di components/wordmark.tsx.

## Logo dan ulasan pengguna

### Perbaikan view public_reviews
Setelah migration 001 dan 002, jalankan `supabase/migrations/003_secure_public_reviews.sql` di SQL Editor. File ini tidak menghapus data dan aman dijalankan ulang. Jangan menjalankan ulang 001/002 jika tabelnya sudah ada.
`public_reviews` adalah view; label UNRESTRICTED pada view bukan bukti tabel pribadi terbuka. Migration 003 menjadikannya security_invoker dan mencabut akses langsung API. Aplikasi membaca ulasan melalui RPC `list_public_reviews` dengan enam kolom publik yang tetap, limit maksimal 100, tanpa user_id/email/profil. Tabel reviews tetap memakai RLS kepemilikan. RPC ini sengaja SECURITY DEFINER untuk daftar ulasan publik; bukan akses bebas ke tabel pribadi.
Jalankan `node scripts/verify-public-reviews.mjs` setelah migration 003 untuk mengecek akses anonim/RPC tanpa menampilkan isi ulasan atau key. Label view di dashboard mungkin tetap ada, karena view tidak memiliki RLS sendiri; yang perlu diverifikasi adalah izin, security_invoker, dan RLS tabel dasarnya.
Logo resmi dari pengguna ada di `public/brand/mybudget-logo.png`, dirender lewat Wordmark. `app/icon.png` memakai gambar asli yang sama untuk ikon tab, tanpa membuat ulang logo.
Jalankan `supabase/migrations/002_reviews.sql` setelah migration 001 untuk mengaktifkan ulasan. Landing memiliki bagian Ulasan; halaman `/reviews` bisa dibuka dari footer dashboard. Pengguna login dapat menulis satu ulasan per akun dan memperbaruinya. Nama tampilan dan teks menjadi publik setelah persetujuan pada form; jangan masukkan informasi keuangan pribadi. Rating 1–5, teks 10–1.000 karakter, nama 2–60 karakter divalidasi browser dan database.
RLS tabel reviews hanya memberi akses row milik sendiri. Setelah migration 003, akses langsung public view dicabut; RPC daftar memproyeksikan hanya nama tampilan, rating, teks, ID ulasan, dan tanggal, tanpa user_id/email/profil. RPC ringkasan hanya mengeluarkan agregat rating. Timestamp ditetapkan DB dan tidak dapat diset browser. Tidak ada label pembelian terverifikasi palsu. Daftar menampilkan 20 ulasan terbaru, rating ringkasan mencakup semuanya. Moderasi/rate limiting tambahan belum tersedia.
Tanpa Supabase, satu ulasan demo bisa diisi, diperbarui, dan dihapus, disimpan lokal dengan label eksplisit; tidak dihitung sebagai testimoni pengguna sungguhan. `/reviews?demo=1` menyediakan uji lokal terpisah bahkan ketika environment Supabase sudah terisi. Mode ini tidak mengubah data atau hak akses server. Integrasi ulasan Supabase/RLS memerlukan migration 002–003 dan pengujian dua akun.
