# My Budget — Phase 1 dan Phase 2 bertahap

Website personal finance Indonesia. Phase 1 tersedia; Phase 2 sedang dilengkapi: paket/entitlement, laporan, ekspor CSV dan checkout manual. Admin/pengaturan/CMS adalah Sesi B. Tidak ada pembayaran otomatis, deployment, atau Phase 3.

## Checkout manual — Phase 2 Sesi A
Urutan migration: 001 → 002 → 003 → 004 → **005_manual_checkout.sql**. Jangan mengulang migration yang sudah terpasang. Migration 005 menambah products, payment_settings, orders, payment_confirmations, entitlements dan fondasi admin_users/is_admin. RLS aktif; pengguna hanya membaca pesanan/konfirmasi/entitlement miliknya. Semua tulisan pesanan lewat RPC; harga/masa akses/merchant/QRIS adalah snapshot dari katalog database. Route `/api/orders` memverifikasi JWT Supabase dan membuang nominal/plan/user_id dari browser. Tidak memakai service-role key.

- Harga produk Plus/Pro berasal dari products; plans tetap sumber kuota. Early Access default nonaktif, Pro 365 hari, promo/harga harus diatur admin nanti. Digital tools belum dijual.
- `pending` berakhir setelah 24 jam. `list_my_orders` mengubah pending yang lewat batas menjadi expired. Submitted tidak otomatis kedaluwarsa.
- Referensi wajib 3–120 karakter, catatan maksimal 1.000, bukti opsional. Konfirmasi hanya menghasilkan submitted, bukan paid/premium. Retry request UUID dan konfirmasi idempotent. Penolakan/persetujuan serta audit dibuat di Sesi B.
- Tambahan nominal pencocokan default mati. Jika admin mengaktifkannya nanti, alokasi 1–999 rupiah tidak dipakai pesanan pending/submitted lain dengan merchant/total yang sama; total dan tambahan disimpan di snapshot.
- Bucket `payment-proofs` **privat**, maksimal 5 MB, MIME JPEG/PNG/WebP. Path user_id/order_id/UUID.ext; upload hanya pemilik pesanan pending. RPC memeriksa path, keberadaan objek dan metadata ukuran/MIME. Bukti ditampilkan pemilik melalui signed URL 60 detik. Tidak ada URL publik permanen. Upload yang berhasil tetapi konfirmasi gagal dapat meninggalkan objek privat; pembersihan objek orphan perlu ditambahkan di admin/operasional nanti.
- Bucket `merchant-qris` publik hanya untuk gambar resmi yang memang ditampilkan ke pembeli; upload dibatasi admin. Jangan unggah bukti pengguna ke bucket ini. Kode tidak membuat, mengubah, atau mengedit payload/gambar QRIS.
- **QRIS belum ada: pembayaran belum tersedia dan create_order ditolak**. Jangan mengaktifkan payment_settings atau menerima pembayaran sebelum Sesi B/admin review dan QRIS resmi diverifikasi. Konfigurasi produk/merchant sementara hanya SQL pemilik proyek; UI pengaturan diselesaikan Sesi B.
- Admin pertama (saat Sesi B siap): cari UUID akun di Authentication → Users, lalu pemilik database menjalankan `insert into public.admin_users(user_id) values ('UUID-AKUN-ADMIN') on conflict do nothing;`. Role tidak berasal dari metadata pengguna; tidak ada UI elevasi sendiri. Admin belum memiliki halaman atau RPC persetujuan di sesi ini.

### Menguji tanpa pembayaran
`/checkout/demo` menampilkan contoh alur, tanpa QRIS, tanpa upload/pesanan/pembayaran/aktivasi. Form bisa disimulasikan, tetapi tidak mengubah Supabase. Label contoh selalu terlihat.
1. Terapkan migration 005 melalui SQL Editor → New query → Run.
2. Jalankan `npm run verify:checkout` dengan dua akun disposable di .env.rls-test. Skrip tidak membuat pesanan nyata, memeriksa API/RLS dan menyiapkan `.rls-checkout-test.sql` yang diabaikan git.
3. Jalankan seluruh `.rls-checkout-test.sql` di SQL Editor. Fixture QRIS/bukti hanya metadata sementara (tidak membuat gambar atau pembayaran). Tes memeriksa katalog/snapshot/retry, isolasi A/B, privatnya bucket, status, referensi, dan konfirmasi tidak mengaktifkan paket. Cari hasil PASS; seluruh transaksi berakhir **ROLLBACK**. Jika editor meninggalkan transaksi gagal, jalankan ROLLBACK sebelum ulang.
4. Regresi: `npm run verify:entitlements`, `npm run verify:phase1-rls`; lalu lint/test/typecheck/build. Persetujuan paralel/idempotent dan CMS diuji di Sesi B, belum diklaim tersedia.

Ekspor CSV Plus/Pro ada di `/api/exports/transactions`: hak akses dicek server lewat get_entitlement, SELECT memakai RLS pemilik, pagination 1.000 per query, output aman terhadap formula spreadsheet. Hindari mengedit transaksi bersamaan dengan ekspor besar; query per halaman bukan snapshot satu transaksi database.

## Jalankan
### Admin pembelian — Sesi B
Setelah migration 005, jalankan `006_admin_purchases.sql`. Buat admin pertama lewat SQL pemilik: `insert into public.admin_users(user_id) values ('UUID-AKUN-ADMIN') on conflict do nothing;`. UUID dari Authentication → Users. Jangan menjadikan akun pengujian admin permanen. Tidak ada service-role key atau role dari user_metadata.
Masuk melalui beranda, buka `/admin/connect`, lalu klik buka akun yang sedang masuk. Server memverifikasi JWT dan is_admin, menyimpan access token saja dalam cookie HttpOnly SameSite Strict (30 menit), kemudian memeriksa akses lagi pada middleware, halaman dan setiap API/RPC. Saat token/cookie habis, buka koneksi admin lagi. Tombol Tutup sesi admin menghapus cookie. UI tidak menyimpan refresh token di cookie server.
Halaman `/admin` menampilkan ringkasan paid, daftar/filter, referensi duplikat, bukti signed URL 60 detik, catatan pemeriksaan dan audit. Admin wajib memeriksa penerimaan dana merchant; tombol persetujuan tidak membuktikan pembayaran otomatis. RPC mengunci baris dan menserialkan perpanjangan per pengguna; source_order_id unik, persetujuan ulang tidak menambah akses atau audit kedua. Paket sama diperpanjang sesudah masa sebelumnya; Plus/Pro berbeda tidak dikonversi atau prorata.
`npm run verify:admin` menyiapkan `.rls-admin-test.sql` dan menguji penolakan non-admin. Jalankan SQL itu sebagai pemilik di SQL Editor; seluruh fixture/admin sementara di-rollback. Persetujuan paralel masih membutuhkan pengujian terpisah; tidak diklaim teruji oleh SQL berurutan ini. Log append-only, transaksi/budget/goal pengguna tidak mendapat policy admin.

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
Checkout, admin, CMS, recurring, digital tools dan AI belum tersedia. Paket/entitlement dan Reports memerlukan migration 004 serta verifikasi live. Tidak meminta QRIS/PIN. Dark mode ditunda. Nominal saldo beranimasi ringan dengan reduced-motion; transaksi optimistic dengan rollback saat gagal, form mempertahankan isi saat error. Jangan mengklaim pembayaran/admin sudah tersedia.

Lihat PROGRESS.md untuk hasil verifikasi dan langkah berikutnya. Logo resmi terpusat di components/wordmark.tsx.

## Reports sederhana (Phase 2 Sesi A)
Menu **Laporan** memakai transaksi aktual akun: grafik enam bulan pemasukan (+) dan pengeluaran (−), tabel angka, kategori pengeluaran terbesar, serta perubahan terhadap bulan sebelumnya. Pengeluaran memakai pola garis agar seri tidak hanya dibedakan oleh warna. Saldo awal, perkiraan onboarding, dan alokasi target tidak masuk arus kas laporan.
Pembanding nol ditampilkan sebagai `Baru` atau `Tidak ada pembanding`; penurunan ke nol dari nominal positif tetap −100%. Bulan berjalan belum selesai. Perhitungan ada di `lib/finance/reports.ts`, diuji dengan `npm test`. Sesuai instruksi terbaru, seluruh halaman Laporan memerlukan Premium aktif: `reports_access` diperiksa database di RPC `get_report_transactions(month)` sebelum query. RPC tidak menerima user_id dan SECURITY INVOKER tetap memakai RLS Phase 1. Free melihat state terkunci dan CTA Paket tanpa data laporan. Dashboard Free hanya menampilkan arus kas bulan ini; grafik enam bulan dipindahkan seluruhnya ke Laporan Premium. Data transaksi pribadi tetap dapat dibaca pemilik untuk CRUD. Laporan lanjutan belum tersedia.

## Paket & entitlement — tanpa checkout
Urutan SQL: 001 → 002 → 003 → **004_plans_entitlements.sql**. Jangan mengulang migration yang sudah terpasang. Migration 004 menambah `plans`, `subscriptions`, RLS dan trigger kuota; semua akun lama dan registrasi baru mendapat Free. Tidak membaca role/plan dari user_metadata. Pengguna hanya SELECT langganan sendiri, tidak dapat INSERT/UPDATE/DELETE langganan atau konfigurasi paket.

Satu sumber kuota adalah row `plans`; satu sumber hak akses adalah `get_entitlement()` (hanya auth.uid(), tanpa argumen pemilik). Plus/Pro `active` dengan `expires_at > now()` mendapat Premium. Tidak punya langganan, cancelled, expired, atau waktu tepat mencapai expires_at memakai Free otomatis tanpa cron. Row langganan boleh tetap berstatus active di penyimpanan setelah waktu berakhir; hak efektif sudah Free. Aktivasi saat ini hanya oleh pemilik database lewat SQL tepercaya; tidak ada UI/RPC aktivasi sendiri, layanan pembayaran atau checkout.

| Batas Free | Aturan |
| --- | --- |
| 50 transaksi | Per bulan tanggal transaksi, bukan waktu input |
| 8 kategori kustom | Total row categories; kategori bawaan tidak dihitung |
| 1 goal aktif | saved < target; target tercapai tidak dihitung |
| 5 kategori budget | Per bulan budget |

Plus/Pro tidak memiliki empat batas itu dan mendapat `reports_access=true`; Free false. Trigger database memeriksa kuota pada INSERT/UPDATE/upsert, dengan penguncian per pengguna untuk request bersamaan. Data lama di atas batas tetap bisa dibaca, dihapus, dan diedit dalam bucket kuota yang sama; menambah/memindahkan ke bulan penuh atau membuka lagi goal tercapai ditolak. Error menampilkan batas dan CTA Paket. UI kategori kustom belum ditambahkan di slice ini; tabel/API categories sudah dibatasi.

Verifikasi:
1. Jalankan migration 004 via Supabase SQL Editor → New query → Run.
2. `npm run verify:entitlements` menggunakan dua akun di .env.rls-test, public key saja. Skrip menguji penolakan Free/RLS/langganan dan menghasilkan `.rls-entitlements-test.sql` lokal yang diabaikan git (berisi UUID akun uji, tanpa password/key).
3. Jalankan seluruh `.rls-entitlements-test.sql` melalui SQL Editor sebagai pemilik database. Tes memakai `SET LOCAL ROLE authenticated` dan JWT sub A/B, menguji paket aktif/kedaluwarsa/tanpa paket, kuota tepat/lebih batas, edit/upsert legacy serta isolasi laporan. Harus muncul `PASS: all assertions` dan diakhiri `ROLLBACK`; tidak meninggalkan data/aktivasi. Jika gagal dan editor tidak menutup transaksi, jalankan `ROLLBACK;` sebelum mengulang. Jangan hapus rollback atau memakai akun pribadi.
4. `npm run verify:phase1-rls` untuk regresi isolasi yang sudah lolos. `npm run lint`, `npm test`, `npm run typecheck`, `npm run build` untuk cek lokal.

Build dapat memakai folder terpisah agar tidak bentrok dengan dev: di PowerShell jalankan `$env:MYBUDGET_BUILD_DIR='.next-verify'; npm run build`. Jalankan `Remove-Item Env:MYBUDGET_BUILD_DIR` sebelum kembali memakai perintah run standar. Folder verifikasi diabaikan git; tidak memakai fitur khusus hosting.

## Logo dan ulasan pengguna

### Perbaikan view public_reviews
Setelah migration 001 dan 002, jalankan `supabase/migrations/003_secure_public_reviews.sql` di SQL Editor. File ini tidak menghapus data dan aman dijalankan ulang. Jangan menjalankan ulang 001/002 jika tabelnya sudah ada.
`public_reviews` adalah view; label UNRESTRICTED pada view bukan bukti tabel pribadi terbuka. Migration 003 menjadikannya security_invoker dan mencabut akses langsung API. Aplikasi membaca ulasan melalui RPC `list_public_reviews` dengan enam kolom publik yang tetap, limit maksimal 100, tanpa user_id/email/profil. Tabel reviews tetap memakai RLS kepemilikan. RPC ini sengaja SECURITY DEFINER untuk daftar ulasan publik; bukan akses bebas ke tabel pribadi.
Jalankan `node scripts/verify-public-reviews.mjs` setelah migration 003 untuk mengecek akses anonim/RPC tanpa menampilkan isi ulasan atau key. Label view di dashboard mungkin tetap ada, karena view tidak memiliki RLS sendiri; yang perlu diverifikasi adalah izin, security_invoker, dan RLS tabel dasarnya.
Logo resmi dari pengguna ada di `public/brand/mybudget-logo.png`, dirender lewat Wordmark. `app/icon.png` memakai gambar asli yang sama untuk ikon tab, tanpa membuat ulang logo.
Jalankan `supabase/migrations/002_reviews.sql` setelah migration 001 untuk mengaktifkan ulasan. Landing memiliki bagian Ulasan; halaman `/reviews` bisa dibuka dari footer dashboard. Pengguna login dapat menulis satu ulasan per akun dan memperbaruinya. Nama tampilan dan teks menjadi publik setelah persetujuan pada form; jangan masukkan informasi keuangan pribadi. Rating 1–5, teks 10–1.000 karakter, nama 2–60 karakter divalidasi browser dan database.
RLS tabel reviews hanya memberi akses row milik sendiri. Setelah migration 003, akses langsung public view dicabut; RPC daftar memproyeksikan hanya nama tampilan, rating, teks, ID ulasan, dan tanggal, tanpa user_id/email/profil. RPC ringkasan hanya mengeluarkan agregat rating. Timestamp ditetapkan DB dan tidak dapat diset browser. Tidak ada label pembelian terverifikasi palsu. Daftar menampilkan 20 ulasan terbaru, rating ringkasan mencakup semuanya. Moderasi/rate limiting tambahan belum tersedia.
Tanpa Supabase, satu ulasan demo bisa diisi, diperbarui, dan dihapus, disimpan lokal dengan label eksplisit; tidak dihitung sebagai testimoni pengguna sungguhan. `/reviews?demo=1` menyediakan uji lokal terpisah bahkan ketika environment Supabase sudah terisi. Mode ini tidak mengubah data atau hak akses server. Integrasi ulasan Supabase/RLS memerlukan migration 002–003 dan pengujian dua akun.
