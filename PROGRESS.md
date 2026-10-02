# Progress My Budget
- [done] Phase 1: fondasi + token + demo lokal kosong, landing dengan contoh berlabel
- [done] Auth dan onboarding: Supabase client, register/login/logout/reset/konfirmasi
- [done] Dashboard dan logika keuangan: saldo, aman dibelanjakan, rata-rata 3 bulan
- [done] Transactions CRUD dan filter: nominal/tanggal/kategori, modal Radix
- [done] Budget dan goals CRUD: per bulan, warning, proyeksi nol/tercapai
- [done] Edit profil dan permintaan perubahan email/password
- [doing] Migration, setup, verifikasi (integrasi live memerlukan Supabase)
- [todo] Phase 2 (belum dimulai)
- [todo] Phase 3 (belum dimulai)

Keputusan: repo kosong. Demo lokal eksplisit saat env Supabase belum tersedia.
Masalah terbuka: akses Supabase, QRIS, logo, hosting belum tersedia.
Keputusan: optimistic update tidak diterapkan ke Supabase agar kegagalan tersaji tanpa rollback rumit.
Kategori awal tetap, tanpa batas jumlah transaksi/goals Phase 1; batas Free ditetapkan di Phase 2.
Vercel Hobby nonkomersial saja menurut dokumentasi; jangan deploy penawaran berbayar di Hobby.
Langkah berikutnya: selesaikan install, typecheck/build/test, uji browser 375/768/1280 dan CRUD demo.
