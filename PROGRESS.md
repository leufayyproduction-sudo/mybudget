# Progress My Budget
- [done] Phase 1: fondasi + token + demo lokal kosong, landing dengan contoh berlabel
- [done] Auth dan onboarding: Supabase client, register/login/logout/reset/konfirmasi
- [done] Dashboard dan logika keuangan: saldo, aman dibelanjakan, rata-rata 3 bulan
- [done] Transactions CRUD dan filter: nominal/tanggal/kategori, modal Radix
- [done] Budget dan goals CRUD: per bulan, warning, proyeksi nol/tercapai
- [done] Edit profil dan permintaan perubahan email/password
- [done] .env.local dibuat tanpa overwrite, gitignored; /setup cek Auth/database tanpa menampilkan key
- [doing] Migration, setup, verifikasi akhir (integrasi live memerlukan Supabase)
- [todo] Phase 2 (belum dimulai)
- [todo] Phase 3 (belum dimulai)

Keputusan: repo kosong. Demo lokal eksplisit saat env Supabase belum tersedia.
Masalah terbuka: akses Supabase, QRIS, logo, hosting belum tersedia.
Optimistic update transaksi dengan rollback saat server gagal; animasi nominal 350ms menghormati reduced motion.
Kategori awal tetap, tanpa batas jumlah transaksi/goals Phase 1; batas Free ditetapkan di Phase 2.
Vercel Hobby nonkomersial saja menurut dokumentasi; jangan deploy penawaran berbayar di Hobby.
Tema disesuaikan sesuai instruksi terbaru: putih + biru 50–900, hijau hanya pemasukan/sukses.
Verifikasi: 4 unit test finance lolos; typecheck lolos; build awal lolos; npm audit 0 vulnerabilities setelah override PostCSS.
Browser: onboarding demo, income Rp20.000, expense Rp5.000, target alokasi Rp10.000 teruji; saldo tidak berkurang oleh target. Ditemukan checkbox budget wajib diterima sebagai boolean oleh react-hook-form; diperbaiki.
Mobile 375px: kelima halaman tanpa horizontal overflow. Navigasi icon-only tablet ditemukan kehilangan nama aksesibel; ditambah aria-label/title.
375/768/1280px: kelima halaman tanpa horizontal overflow. CRUD transaksi + search/filter, edit profil, budget wajib, target alokasi nol dan target tercapai diuji via browser demo. /setup dengan env kosong menunjukkan instruksi dan tidak memaparkan key.
Langkah berikutnya: build final lalu uji browser 375/768/1280 dan CRUD demo.
