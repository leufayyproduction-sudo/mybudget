-- Phase 1. No premium/admin fields are user editable. All values are integer rupiah.
create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null,
 constraint profile_valid check (jsonb_typeof(data->'name')='string' and length(data->>'name') between 1 and 60
 and data->>'pattern' in ('Penghasilan tetap','Freelance/tidak tetap','Campuran')
 and data->>'purpose' in ('Mengatur pengeluaran','Menabung','Mengontrol budget','Mencapai target keuangan','Memahami kondisi keuangan')
 and (data->>'opening')::numeric between 0 and 1000000000000
 and (data->>'fixed')::numeric between 0 and 1000000000000
 and (data->>'project')::numeric between 0 and 1000000000000
 and (data->>'projects')::numeric between 0 and 1000
 and (data->>'opening')::numeric=trunc((data->>'opening')::numeric)
 and (data->>'fixed')::numeric=trunc((data->>'fixed')::numeric)
 and (data->>'project')::numeric=trunc((data->>'project')::numeric)
 and (data->>'projects')::numeric=trunc((data->>'projects')::numeric)),
 constraint profile_required check (data ?& array['name','pattern','purpose','opening','fixed','project','projects'])
);
create table public.categories (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (length(name) between 1 and 60), unique(user_id,name), unique(id,user_id)
);
create table public.transactions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 data jsonb not null, category_id uuid,
 foreign key (category_id,user_id) references public.categories(id,user_id),
 constraint transaction_required check (data ?& array['amount','type','category','description','date']),
 constraint transaction_valid check ((data->>'amount')::numeric between 1 and 1000000000000
 and (data->>'amount')::numeric=trunc((data->>'amount')::numeric)
 and data->>'type' in ('income','expense') and length(data->>'description')<=180
 and data->>'category' in ('Makan & minum','Transportasi','Belanja','Tagihan','Kesehatan','Hiburan','Lainnya','Project','Gaji')
 and data->>'date' ~ '^\d{4}-\d{2}-\d{2}$'
 and (data->>'date')::date<=(now() at time zone 'Asia/Jakarta')::date)
);
create table public.budgets (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 data jsonb not null, category_id uuid,
 foreign key (category_id,user_id) references public.categories(id,user_id),
 constraint budget_required check (data ?& array['amount','category','month','mandatory']),
 constraint budget_valid check ((data->>'amount')::numeric between 1 and 1000000000000
 and (data->>'amount')::numeric=trunc((data->>'amount')::numeric)
 and data->>'month' ~ '^\d{4}-(0[1-9]|1[0-2])$' and jsonb_typeof(data->'mandatory')='boolean'
 and data->>'category' in ('Makan & minum','Transportasi','Belanja','Tagihan','Kesehatan','Hiburan','Lainnya'))
);
create unique index budget_category_month on public.budgets(user_id,(data->>'category'),(data->>'month'));
create table public.goals (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 data jsonb not null,
 constraint goal_required check (data ?& array['name','target','saved','monthly']),
 constraint goal_valid check (length(data->>'name') between 1 and 80
 and (data->>'target')::numeric between 1 and 1000000000000
 and (data->>'saved')::numeric between 0 and 1000000000000
 and (data->>'monthly')::numeric between 0 and 1000000000000
 and (data->>'target')::numeric=trunc((data->>'target')::numeric)
 and (data->>'saved')::numeric=trunc((data->>'saved')::numeric)
 and (data->>'monthly')::numeric=trunc((data->>'monthly')::numeric))
);
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.goals enable row level security;
create policy own_profile on public.profiles for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy own_categories on public.categories for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy own_transactions on public.transactions for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy own_budgets on public.budgets for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy own_goals on public.goals for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create index transactions_owner on public.transactions(user_id);
create index goals_owner on public.goals(user_id);
grant select,insert,update,delete on public.profiles,public.categories,public.transactions,public.budgets,public.goals to authenticated;
revoke all on public.profiles,public.categories,public.transactions,public.budgets,public.goals from anon;

-- SQL CHECK treats null as valid; reject JSON null values explicitly.
create function public.reject_null_finance_fields() returns trigger language plpgsql set search_path = '' as $$
begin
 if exists(select 1 from jsonb_each(new.data) as f where f.value='null'::jsonb) then
   raise exception 'Financial fields must not be null';
 end if;
 return new;
end $$;
create trigger profiles_no_null before insert or update on public.profiles for each row execute function public.reject_null_finance_fields();
create trigger transactions_no_null before insert or update on public.transactions for each row execute function public.reject_null_finance_fields();
create trigger budgets_no_null before insert or update on public.budgets for each row execute function public.reject_null_finance_fields();
create trigger goals_no_null before insert or update on public.goals for each row execute function public.reject_null_finance_fields();
