begin;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end$$;
select pg_temp.assert_true(public.valid_site_support('{"support":{"phone":"6288806001355","message":"Halo","hours":"Belum ditetapkan"}}'),'valid support');
select pg_temp.assert_true(not public.valid_site_support('{"support":{"phone":"+6288806001355","message":"Halo","hours":"Belum ditetapkan"}}'),'plus sign rejected');
select pg_temp.assert_true(not public.valid_site_support('{"support":{"phone":"6288806001355","message":"","hours":"Belum ditetapkan"}}'),'empty message rejected');
select pg_temp.assert_true(not public.valid_site_support('{"support":{"phone":"6288806001355","message":"Halo","hours":"WIB","url":"https://other.test"}}'),'unstructured URL rejected');
select pg_temp.assert_true(public.valid_site_support('{}'),'legacy defaults supported');
select 'PASS: support CMS validation; rollback' as result;
rollback;
