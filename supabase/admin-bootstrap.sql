-- Jalankan MANUAL sebagai pemilik proyek di Supabase SQL Editor.
-- Akun harus sudah terdaftar dan email dikonfirmasi di Supabase Auth.
-- Setelah migration 006 (admin_users berasal dari fondasi migration 005).
-- Tidak menjalankan pembayaran atau memberi paket Premium.
begin;
do $$
declare target_id uuid; matches bigint; confirmed boolean;
begin
 if to_regclass('public.admin_users') is null then
  raise exception 'Terapkan migration 005 dan 006 terlebih dahulu.';
 end if;
 select count(*),(array_agg(id))[1],bool_and(email_confirmed_at is not null)
 into matches,target_id,confirmed from auth.users
 where lower(email)=lower('leufayyproduction@gmail.com');
 if matches<>1 then
  raise exception 'Harus ada tepat satu akun leufayyproduction@gmail.com di Authentication > Users. Daftarkan akun dahulu jika belum ada.';
 end if;
 if confirmed is distinct from true then
  raise exception 'Konfirmasi email akun admin terlebih dahulu, lalu ulangi bootstrap.';
 end if;
 insert into public.admin_users(user_id) values(target_id) on conflict(user_id) do nothing;
end $$;
commit;
select 'Admin leufayyproduction@gmail.com sudah tersimpan; masuk di website lalu buka /admin/connect.' as result;
