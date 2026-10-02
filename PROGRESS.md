# Progress My Budget
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
