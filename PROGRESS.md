# Progress My Budget

## Sesi aktif — Phase 2 Sesi B, admin/pengaturan/CMS
- Pengguna mengizinkan Phase 2 keseluruhan; lanjut slice checkout manual dari fondasi paket/entitlement yang lolos. Berhenti di akhir Sesi A; Sesi B terpisah.
- [done] Implementasi checkout/pesanan: katalog produk, snapshot server, status pending/submitted/expired, bukti privat, riwayat. Migration 005 live dan verifikasi API passed; assertions SQL dilaporkan PASS oleh pengguna.
- QRIS resmi belum tersedia: jangan menerima pembayaran atau membuat pesanan yang tak bisa dibayar. Tidak deploy.
- [done] Verifikasi Phase 1 Supabase sungguhan: passed, cleanup passed (2026-10-02); laporan lokal diperiksa.
- [done] Sesi A: Reports → produk/entitlement → checkout manual
- [doing] Sesi B: admin → pengaturan produk/QRIS → CMS → verifikasi (pengguna meminta mulai)
- [done] Implementasi slice admin: migration 006, halaman/admin API terproteksi, audit, review atomik/idempotent, renewal serial. 23 tests, TypeScript dan production build termasuk lint lolos.
- Belum bisa diuji slice admin: migration 006 live, assertions SQL dan persetujuan paralel. npm run verify:admin menyiapkan .rls-admin-test.sql; API masih blocked sebelum migration diterapkan. Admin nyata/QRIS merchant belum dikonfigurasi.
- [done] Implementasi slice pengaturan: migration 007, katalog/promo/QRIS global/per produk, validasi aset, file privat dengan paid check dan log; 25 unit tests, TypeScript dan production build termasuk lint lolos. QRIS merchant asli tidak tersedia; migration/SQL live masih belum diuji.
- Phase 3 tidak dimulai. Tidak ada pembayaran nyata atau deployment.

### Checkout — serah terima Sesi A
- [done] Migration 005: products, orders, confirmations, entitlements, admin_users terproteksi, payment_settings, bucket bukti privat. RPC mengambil harga katalog, mengunci pesanan, dan konfirmasi tidak memberi paket.
- [done] Checkout dan riwayat pembelian; jika QRIS resmi belum tersedia, pesanan ditolak. Simulasi /checkout/demo diberi label dan tidak menghubungi RPC pembayaran.
- [done] Ekspor CSV server Plus/Pro: cek entitlement, query milik pengguna dengan RLS, pagination, perlindungan formula spreadsheet.
- Sudah diuji: 21/21 unit test; lint dan TypeScript; API anonim orders/CSV ditolak 401; simulasi konfirmasi tidak mengaktifkan Premium. Layout checkout contoh 375/768/1280 tanpa overflow horizontal, screenshot docs/checkout-demo-*.png.
- [done] Production build akhir lolos di .next-verify, termasuk lint/TypeScript dan semua route checkout/API. Environment lokal dan SQL akun uji terkonfirmasi gitignored.
- [done] Verifikasi API Supabase dua akun diulang: passed (docs/checkout-result.json). Pengguna melaporkan PASS assertions SQL dan rollback (docs/checkout-sql-result.json); hasil SQL dicatat sebagai user-reported, bukan eksekusi agen. Field SQL pending pada laporan API berarti skrip API tidak mengeksekusi SQL owner.
- Belum bisa diuji: CSV Premium live, upload/download byte bukti sungguhan, QRIS merchant asli dan pembayaran nyata. Admin persetujuan paralel/idempotent serta CMS adalah Sesi B, belum diimplementasikan.
- Keputusan: pending kedaluwarsa 24 jam saat dibaca; submitted tidak kedaluwarsa otomatis. Snapshot harga tidak berubah bersama katalog; request UUID dan konfirmasi idempotent. Bukti JPEG/PNG/WebP maksimal 5 MB, signed URL 60 detik. Nominal unik default mati; Early Access belum aktif; tools belum dijual.
- Langkah berikutnya: Sesi A selesai dan gate checkout lolos; sesi berikutnya Sesi B admin/QRIS/CMS dan verifikasi lengkap. Jangan mengulang migration 005. Phase 2 keseluruhan belum selesai; Phase 3 tetap belum dimulai.

### Slice paket & entitlement (instruksi terbaru)
- [done] Migration 004: plans menjadi sumber batas; subscriptions per user, backfill Free + trigger akun baru; pengguna hanya boleh membaca langganan sendiri.
- [done] Sumber kebenaran get_entitlement() tanpa argumen user; expiry/status diperiksa setiap panggilan; Free fallback untuk user tanpa paket/kedaluwarsa.
- [done] Trigger kuota: 50 transaksi/bulan tanggal transaksi, 8 kategori kustom, 1 goal belum tercapai, 5 kategori budget/bulan. Plus/Pro tanpa batas tersebut.
- [done] RPC get_report_transactions(month): reports_access wajib, security invoker + RLS Phase 1, hanya auth.uid(); UI tidak menerima data dashboard untuk laporan.
- [done] State terkunci + CTA ke Paket, halaman katalog/status; recheck akses pada fokus/60 detik, data laporan dibuang saat expiry.
- [done] Test SQL rollback untuk user tanpa paket, Free tepat/lebih batas, Plus/Pro aktif, kedaluwarsa, cancelled, edit/upsert data legacy, report A/B, write langganan/config ditolak.
- [done] Lint dan TypeScript lolos; 17/17 tests (16 finance + state terkunci tanpa data) lolos. Production build termasuk pemeriksaan lint/TypeScript lolos.
- [done] Migration 004 live terkonfirmasi melalui API. npm run verify:entitlements passed: Free RPC ditolak, langganan lintas pengguna tidak terbaca, insert/update langganan sendiri/lintas akun dan edit plans ditolak.
- [done] Pengguna melaporkan hasil akhir SQL Editor: PASS: all assertions; rollback removes fixtures and temporary upgrades. Mencakup Premium aktif/kedaluwarsa, semua kuota, data legacy, dan laporan A/B. Bukti dicatat terpisah di docs/entitlements-sql-result.json sebagai user-reported, bukan eksekusi agen.
- [done] Regresi live npm run verify:phase1-rls setelah migration 004: passed, cleanup passed. RLS dua akun, composite FK, validasi nominal/tanggal tetap lolos.
- [done] Visual state terkunci 375/768/1280: browser berhasil setelah preview dikompilasi dan tab dibuka ulang; tanpa overflow horizontal, tanpa chart/table/nominal laporan. Screenshots docs/reports-locked-{375,768,1280}.png; rincian docs/reports-visual-result.json.
- Sudah diuji: shape state terkunci tidak mengandung nominal/tabel/grafik, test finance tidak regresi, build berhasil, syntax skrip valid, environment dan SQL lokal akun uji gitignored. npm audit 0 setelah menambah alat lint development yang diperlukan.
- Sudah diuji tambahan: visual LockedReports dalam demo (komponen yang sama dengan Free), CTA membuka Paket, katalog Free/Plus/Pro sungguhan termuat; profil demo sementara dan viewport override dibersihkan. Lint/typecheck dan 17 tests lolos setelah perbaikan UX.
- [done] Production build akhir setelah perbaikan UX lolos (.next-verify); tidak ada perubahan SQL atau checkout pada sesi visual ini.
- Belum diuji di browser: UI laporan Premium aktif (akses/backend dan expiry sudah diuji SQL). Laporan docs/entitlements-result.json hanya memuat pemeriksaan API otomatis; field premium_sql_test pending di sana berarti skrip API tidak menjalankan SQL owner. Hasil SQL pengguna tersimpan terpisah di docs/entitlements-sql-result.json.
- Keputusan: plans berisi free/plus/pro; langganan satu row/user, status active/cancelled/expired, expires_at wajib bagi Premium. Aktivasi hanya SQL pemilik sampai admin/pembelian dikerjakan nanti. Tidak ada checkout atau pembayaran.
- Keputusan: batas diterapkan pada pertumbuhan kuota, bukan menghapus data. Edit/upsert dalam bucket lama tetap boleh setelah expiry, perpindahan bulan dan membuka lagi goal tercapai diperiksa ulang. Kategori bawaan tidak memakai kuota kategori kustom.
- Keputusan: arus kas enam bulan di Dashboard diganti ringkasan bulan berjalan, agar fitur Laporan Premium tidak terbuka lewat UI lain. Tidak ada data laporan sebagian pada state terkunci. FAB disembunyikan pada Laporan/Paket karena menutup manfaat di 375px; pemilih bulan hanya muncul setelah laporan dibuka untuk Premium.
- Langkah berikutnya: berhenti setelah slice paket/entitlement sesuai scope pengguna. Checkout dan Phase 3 tidak dimulai. Slice backend 0cba094; verifikasi database b844657; bukti visual dan perbaikan responsif disimpan pada commit sesi ini.

### Sudah diuji
- `npm test`: 12/12 finance tests lolos, termasuk data kosong, Rp20.000, saldo/alokasi negatif, goal nol/tercapai, pembulatan, lintas tahun.
- `npm run verify:phase1-rls`: Auth Supabase sungguhan dapat dijangkau dengan public key.
- Sintaks skrip verifikasi valid (`node --check`); .env.rls-test diabaikan git.
- Typecheck dan production build lolos. Tidak ada perubahan UI pada sesi prasyarat ini.

### Belum bisa diuji
- RLS live dua akun selesai: baca/update/delete/insert lintas pemilik ditolak dua arah; composite FK dan nominal/tanggal invalid ditolak; fixture dibersihkan.
- Reports mulai diimplementasikan; produk/entitlement dan checkout belum dimulai. QRIS merchant, pembayaran sungguhan dan hosting produksi belum dikonfigurasi.
- Hasil aman tanpa rahasia: docs/phase1-rls-result.json (status passed, cleanup passed).

### Keputusan yang diambil
- Patuhi gate pengguna: jangan membangun Phase 2 sebelum RLS live dua akun lolos.
- Verifikasi menggunakan anon/publishable key + dua akun khusus, bukan service_role/secret key.
- Akun uji harus baru, email dikonfirmasi, tanpa onboarding; fixture sementara dibersihkan, akun Auth tidak dihapus.
- Batas Free, perpanjangan entitlement, dan kedaluwarsa pesanan belum diimplementasikan/diklaim; ditetapkan pada slice Sesi A setelah gate lolos.
- Hosting komersial memakai paket/provider yang mengizinkan komersial, tetap portabel dengan Next.js standar.

Langkah berikutnya: lanjut Sesi A setelah gate RLS passed; selesaikan Reports, lalu produk/entitlement dan checkout manual. Migration 003 ulasan tetap perlu dikonfirmasi dengan node scripts/verify-public-reviews.mjs.

### Sesi A — Reports
- [done] Perhitungan murni lib/finance/reports.ts: enam bulan, kategori pengeluaran, perbandingan bulan; nol memakai Baru/Tidak ada pembanding.
- [done] UI Laporan terhubung ke data milik pengguna yang dimuat melalui RLS; data demo tetap lokal dan berlabel.
- [done] Unit test 16/16 dan typecheck lolos.
- [done] Production build termasuk TypeScript/lint bawaan Next lolos di .next-verify. Build awal pada .next gagal invariant /_not-found; folder verifikasi terpisah mengatasi benturan artefak dev/build.
- [todo] Uji visual 375/768/1280: browser preview gagal merespons CDP (tiga timeout). Tidak diklaim teruji; tabel angka tersedia sebagai alternatif grafik dan layout CSS mobile disiapkan.
- Keputusan: Reports sederhana memakai query transactions yang sudah teruji RLS; tidak perlu migration baru karena tidak menyimpan data turunan.
- Titik lanjut stabil: Reports sudah build lolos. Sesi A belum selesai; jangan menganggap paket/checkout sudah tersedia. Langkah berikutnya: uji visual Reports saat browser tersedia, lalu slice 2.2 products/entitlements + batas Free/CSV server, baru 2.3 checkout manual. Phase 3 tetap todo.

### Perbaikan akses ulasan publik
- [done] Source membaca RPC dengan kolom publik tetap; migration 003 membuat view security_invoker dan mencabut akses langsung anon/authenticated.
- [done] Skrip cek akses publik tanpa mencetak key atau isi ulasan.
- [done] Production build termasuk pemeriksaan TypeScript/lint bawaan Next lolos; sintaks skrip valid. .env.local dan .env.rls-test tetap diabaikan git.
- [done] Laporan docs/public-reviews-result.json terbaru passed: RPC publik tersedia, akses anonim langsung reviews/public_reviews ditolak. Laporan diperiksa pada sesi ini.
- [todo] Uji kepemilikan ulasan dengan dua akun. Label UNRESTRICTED pada view bukan hasil pengujian RLS tabel.

## Riwayat pekerjaan sebelumnya
- [done] Phase 1: fondasi + token + demo lokal kosong, landing dengan contoh berlabel
- [done] Auth dan onboarding: Supabase client, register/login/logout/reset/konfirmasi
- [done] Dashboard dan logika keuangan: saldo, aman dibelanjakan, rata-rata 3 bulan
- [done] Transactions CRUD dan filter: nominal/tanggal/kategori, modal Radix
- [done] Budget dan goals CRUD: per bulan, warning, proyeksi nol/tercapai
- [done] Edit profil dan permintaan perubahan email/password
- [done] .env.local dibuat tanpa overwrite, gitignored; /setup cek Auth/database tanpa menampilkan key
- [done] Migration, setup, verifikasi lokal; integrasi live memerlukan Supabase
- [todo] Phase 2 (belum dimulai)
- [todo] Phase 3 (belum dimulai)

Keputusan: repo kosong. Demo lokal eksplisit saat env Supabase belum tersedia.
Masalah terbuka: akses Supabase, QRIS, hosting belum tersedia.
Logo resmi sudah diberikan dan dipasang; navbar landing memakai blue-100.
- [done] Logo terpusat dan icon tab dari file asli pengguna
- [done] Ulasan pengguna: rating, filter, edit/hapus, persistence demo/Supabase; migration 002
Verifikasi ulasan: typecheck dan build lolos; browser demo simpan/edit rating/filter dan persetujuan wajib lolos. Environment Supabase telah terisi oleh pengguna; tabel ulasan belum dapat diakses. Migration 002 dan uji live RLS ulasan masih perlu dijalankan.
Browser ulasan 375/768/1280px: tidak ada overflow; persistence reload dan hapus demo teruji. Bukti visual docs/reviews-demo.jpg (data pengujian berlabel demo, telah dihapus dari browser).
Verifikasi final logo/ulasan: production build termasuk TypeScript lolos; favicon /icon.png dan tiga instance logo termuat. Landing 375/768/1280 tanpa overflow. File logo dan favicon identik dengan file asli pengguna (hash cocok). Dua commit fitur disimpan; .env.local tetap tidak tracked.
Langkah berikutnya untuk ulasan publik: jalankan 002_reviews.sql pada Supabase SQL Editor, lalu uji dua akun. Ulasan demo di /reviews?demo=1 tidak pernah dipublikasikan otomatis.
Optimistic update transaksi dengan rollback saat server gagal; animasi nominal 350ms menghormati reduced motion.
Kategori awal tetap, tanpa batas jumlah transaksi/goals Phase 1; batas Free ditetapkan di Phase 2.
Vercel Hobby nonkomersial saja menurut dokumentasi; jangan deploy penawaran berbayar di Hobby.
Tema disesuaikan sesuai instruksi terbaru: putih + biru 50–900, hijau hanya pemasukan/sukses.
Verifikasi final: 8 unit test finance lolos; typecheck lolos; production build lolos; npm audit 0 vulnerabilities setelah override PostCSS.
Browser: onboarding demo, income Rp20.000, expense Rp5.000, target alokasi Rp10.000 teruji; saldo tidak berkurang oleh target. Ditemukan checkbox budget wajib diterima sebagai boolean oleh react-hook-form; diperbaiki.
Mobile 375px: kelima halaman tanpa horizontal overflow. Navigasi icon-only tablet ditemukan kehilangan nama aksesibel; ditambah aria-label/title.
375/768/1280px: kelima halaman tanpa horizontal overflow. CRUD transaksi + search/filter, edit profil, CRUD budget/target, budget wajib, target alokasi nol dan target tercapai diuji via browser demo. /setup dengan env kosong menunjukkan instruksi dan tidak memaparkan key. Data pengujian demo dibersihkan setelah selesai.
Belum teruji live: email konfirmasi/reset, RLS dua akun, migration PostgreSQL. Premium/admin/pembayaran belum diimplementasikan (Phase 2), sehingga belum dapat diuji.
Phase 1 MVP lokal selesai. Tidak lanjut otomatis ke Phase 2.
Langkah berikutnya: pengguna isi dua variabel publik di .env.local, jalankan migration SQL di Supabase, restart dev, cek /setup, lalu uji register/konfirmasi/reset dan isolasi dua akun. Phase 2 hanya setelah diminta.
