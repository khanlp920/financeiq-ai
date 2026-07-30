-- ═══════════════════════════════════════════════════════════════════════════
-- FinanceIQ AI — initial schema
-- Row Level Security everywhere: every row is scoped to auth.uid().
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Profiles (mirrors auth.users; subscription-ready) ───────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  plan text not null default 'free' check (plan in ('free', 'pro', 'business')),
  plan_renews_at timestamptz,
  stripe_customer_id text,          -- reserved for billing integration
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: update own" on public.profiles for update using (auth.uid() = id);
create policy "profiles: insert own" on public.profiles for insert with check (auth.uid() = id);

-- Auto-create a profile row on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data ->> 'full_name', ''),
          coalesce(new.raw_user_meta_data ->> 'avatar_url', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Statements (uploaded files metadata) ────────────────────────────────────
create table public.statements (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  file_name text not null,
  file_type text not null check (file_type in ('pdf', 'csv', 'xlsx')),
  uploaded_at timestamptz not null default now(),
  row_count integer not null default 0,
  bank_name text
);

alter table public.statements enable row level security;
create policy "statements: all own" on public.statements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index statements_user_idx on public.statements (user_id, uploaded_at desc);

-- ── Transactions ────────────────────────────────────────────────────────────
create table public.transactions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  statement_id text references public.statements (id) on delete set null,
  date date not null,
  description text not null,
  amount numeric(14, 2) not null,
  debit numeric(14, 2) not null default 0,
  credit numeric(14, 2) not null default 0,
  balance numeric(14, 2),
  account_number text,
  bank_name text,
  category text not null default 'Others',
  merchant text not null default 'Unknown',
  type text not null check (type in ('debit', 'credit')),
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;
create policy "transactions: all own" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index txn_user_date_idx     on public.transactions (user_id, date desc);
create index txn_user_category_idx on public.transactions (user_id, category);
create index txn_user_merchant_idx on public.transactions (user_id, merchant);

-- ── Budgets ─────────────────────────────────────────────────────────────────
create table public.budgets (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null,
  month text not null,               -- 'YYYY-MM'
  limit_amount numeric(14, 2) not null check (limit_amount >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, category, month)
);

alter table public.budgets enable row level security;
create policy "budgets: all own" on public.budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Storage: private bucket for original statement files ────────────────────
insert into storage.buckets (id, name, public) values ('statements', 'statements', false)
on conflict (id) do nothing;

create policy "storage: read own statements" on storage.objects
  for select using (bucket_id = 'statements' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "storage: upload own statements" on storage.objects
  for insert with check (bucket_id = 'statements' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "storage: delete own statements" on storage.objects
  for delete using (bucket_id = 'statements' and (storage.foldername(name))[1] = auth.uid()::text);
