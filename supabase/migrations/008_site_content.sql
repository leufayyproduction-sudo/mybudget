begin;
create function public.valid_site_destination(v text) returns boolean language sql immutable set search_path='' as $$
 select coalesce(length(v) between 1 and 500 and v !~ '[[:space:]<>]' and position(chr(92) in v)=0 and ((left(v,1)='/' and left(v,2)<>'//') or v ~ '^https?://[^/@[:space:]]+([/?#][^[:space:]]*)?$'),false);
$$;
create function public.valid_site_content(c jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare item jsonb; field text;
begin
 if c is null or jsonb_typeof(c)<>'object' then return false; end if;
 foreach field in array array['headline','description','cta_label','cta_url','feature_heading','footer'] loop
  if jsonb_typeof(c->field) is distinct from 'string' or length(btrim(c->>field))=0 then return false;end if;
 end loop;
 if length(c->>'headline')>120 or length(c->>'description')>500 or length(c->>'cta_label')>40 or length(c->>'feature_heading')>120 or length(c->>'footer')>240 or not public.valid_site_destination(c->>'cta_url') then return false;end if;
 if not c ? 'logo_path' or (c->'logo_path'<>'null'::jsonb and (jsonb_typeof(c->'logo_path')<>'string' or (c->>'logo_path'<>'/brand/mybudget-logo.png' and c->>'logo_path' !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp)$'))) then return false;end if;
 if jsonb_typeof(c->'features') is distinct from 'array' or jsonb_typeof(c->'steps') is distinct from 'array' then return false;end if;
 if jsonb_array_length(c->'features') not between 1 and 6 or jsonb_array_length(c->'steps') not between 1 and 4 then return false;end if;
 for item in select value from jsonb_array_elements(c->'features') loop
  if jsonb_typeof(item->'title') is distinct from 'string' or jsonb_typeof(item->'description') is distinct from 'string' or length(btrim(item->>'title')) not between 1 and 80 or length(btrim(item->>'description')) not between 1 and 240 then return false;end if;
 end loop;
 for item in select value from jsonb_array_elements(c->'steps') loop
  if jsonb_typeof(item->'title') is distinct from 'string' or jsonb_typeof(item->'description') is distinct from 'string' or length(btrim(item->>'title')) not between 1 and 40 or length(btrim(item->>'description')) not between 1 and 180 then return false;end if;
 end loop;
 return true;
end $$;
create table public.site_content_draft(id integer primary key default 1 check(id=1),content jsonb not null check(public.valid_site_content(content)),revision integer not null default 1,updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now());
create table public.site_content_published(id integer primary key default 1 check(id=1),content jsonb not null check(public.valid_site_content(content)),revision integer not null,published_by uuid not null references auth.users(id),published_at timestamptz not null default now());
alter table public.site_content_draft enable row level security;
alter table public.site_content_published enable row level security;
revoke all on public.site_content_draft,public.site_content_published from public,anon,authenticated;
grant select on public.site_content_draft to authenticated;
grant select on public.site_content_published to anon,authenticated;
create policy admin_draft_read on public.site_content_draft for select to authenticated using(public.is_admin());
create policy published_read on public.site_content_published for select to anon,authenticated using(true);
create function public.admin_save_site_draft(p_content jsonb,p_revision integer) returns public.site_content_draft language plpgsql security definer set search_path='' as $$
declare d public.site_content_draft; old_revision integer;
begin
 if not public.is_admin() then raise exception 'Akses admin diperlukan.' using errcode='42501';end if;
 if p_revision is null or not public.valid_site_content(p_content) then raise exception 'Konten/URL tidak valid.' using errcode='22023';end if;
 if p_content->>'logo_path' is not null and p_content->>'logo_path'<>'/brand/mybudget-logo.png' and not exists(select 1 from storage.objects where bucket_id='site-assets' and name=p_content->>'logo_path') then raise exception 'Aset logo tidak ditemukan.' using errcode='22023';end if;
 perform pg_advisory_xact_lock(81234567);
 select * into d from public.site_content_draft where id=1 for update;old_revision:=coalesce(d.revision,0);
 if p_revision<>old_revision then raise exception 'Draft berubah. Muat ulang sebelum menyimpan.' using errcode='22023';end if;
 insert into public.site_content_draft(id,content,revision,updated_by) values(1,p_content,old_revision+1,auth.uid()) on conflict(id) do update set content=excluded.content,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=now() returning * into d;
 insert into public.audit_logs(admin_id,action,object_id,before_data,after_data) values(auth.uid(),'content.draft','1',jsonb_build_object('revision',old_revision),jsonb_build_object('revision',d.revision));return d;
end $$;
create function public.admin_publish_site(p_revision integer) returns public.site_content_published language plpgsql security definer set search_path='' as $$
declare d public.site_content_draft; p public.site_content_published; old_revision integer;
begin
 if not public.is_admin() then raise exception 'Akses admin diperlukan.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(81234567);
 select * into d from public.site_content_draft where id=1 for update;
 if not found or p_revision is null or d.revision<>p_revision then raise exception 'Simpan dan preview draft terbaru sebelum publish.' using errcode='22023';end if;
 select revision into old_revision from public.site_content_published where id=1;
 if old_revision=p_revision then select * into p from public.site_content_published where id=1;return p;end if;
 insert into public.site_content_published(id,content,revision,published_by) values(1,d.content,d.revision,auth.uid()) on conflict(id) do update set content=excluded.content,revision=excluded.revision,published_by=excluded.published_by,published_at=now() returning * into p;
 insert into public.audit_logs(admin_id,action,object_id,before_data,after_data) values(auth.uid(),'content.publish','1',jsonb_build_object('revision',old_revision),jsonb_build_object('revision',p.revision,'published_at',p.published_at));return p;
end $$;
revoke all on function public.admin_save_site_draft(jsonb,integer),public.admin_publish_site(integer) from public,anon;
grant execute on function public.admin_save_site_draft(jsonb,integer),public.admin_publish_site(integer) to authenticated;
notify pgrst,'reload schema';
commit;
