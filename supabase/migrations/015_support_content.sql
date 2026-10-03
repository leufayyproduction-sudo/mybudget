begin;
create or replace function public.valid_site_support(c jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare s jsonb;
begin
 -- Legacy content receives defaults in code until this migration is applied.
 if not c ? 'support' then return true;end if;
 s:=c->'support';
 if jsonb_typeof(s) is distinct from 'object' then return false;end if;
 if not s ?& array['phone','message','hours'] or (select count(*) from jsonb_object_keys(s))<>3 then return false;end if;
 if jsonb_typeof(s->'phone') is distinct from 'string' or (s->>'phone') !~ '^62[1-9][0-9]{7,12}$' then return false;end if;
 if jsonb_typeof(s->'message') is distinct from 'string' or length(btrim(s->>'message')) not between 1 and 300 then return false;end if;
 if jsonb_typeof(s->'hours') is distinct from 'string' or length(btrim(s->>'hours')) not between 1 and 120 then return false;end if;
 return true;
end $$;
do $$begin
 if not exists(select 1 from pg_constraint where conrelid='public.site_content_draft'::regclass and conname='draft_support_valid') then alter table public.site_content_draft add constraint draft_support_valid check(public.valid_site_support(content));end if;
 if not exists(select 1 from pg_constraint where conrelid='public.site_content_published'::regclass and conname='published_support_valid') then alter table public.site_content_published add constraint published_support_valid check(public.valid_site_support(content));end if;
end $$;
-- Only fill missing fields; never replace an admin's configured support values or publish a draft.
update public.site_content_draft set content=content||jsonb_build_object('support',jsonb_build_object('phone','6288806001355','message','Halo My Budget, saya butuh bantuan.','hours','Setiap hari, 08.00-21.00 WIB. Pesan di luar jam itu dibalas paling lambat 1x24 jam')),revision=revision+1,updated_at=now() where not content ? 'support';
update public.site_content_published set content=content||jsonb_build_object('support',jsonb_build_object('phone','6288806001355','message','Halo My Budget, saya butuh bantuan.','hours','Setiap hari, 08.00-21.00 WIB. Pesan di luar jam itu dibalas paling lambat 1x24 jam')) where not content ? 'support';
notify pgrst,'reload schema';
commit;
