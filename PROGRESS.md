# Progress My Budget

## Sesi aktif — prasyarat Phase 2 Sesi A
- [done] Verifikasi Phase 1 Supabase sungguhan: passed, cleanup passed (2026-10-02); laporan lokal diperiksa.
- [doing] Sesi A: Reports → produk/entitlement → checkout manual
- [todo] Sesi B: admin → pengaturan produk/QRIS → CMS → verifikasi (belum mulai)
- Phase 3 tidak dimulai. Tidak ada pembayaran nyata atau deployment.

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
