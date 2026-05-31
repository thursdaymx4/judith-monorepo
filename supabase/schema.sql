-- Judith — Supabase schema (profiles + bills) with Row Level Security
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  persona text not null default 'professional'
    check (persona in ('professional', 'funny', 'sarcastic', 'mom')),
  voice_id text,
  subscription_status text not null default 'free'
    check (subscription_status in ('free', 'trial', 'active', 'expired')),
  reminders_enabled boolean not null default true,
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- bills
-- ---------------------------------------------------------------------------
create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  category text not null default 'custom'
    check (category in ('electricity', 'water', 'internet', 'mobile', 'landline', 'credit_card', 'custom')),
  provider text,
  amount_type text not null default 'fixed'
    check (amount_type in ('fixed', 'variable')),
  amount numeric(12, 2),
  due_day int check (due_day between 1 and 31),
  due_date date,
  cadence text not null default 'monthly'
    check (cadence in ('monthly', 'one_time')),
  status text not null default 'upcoming'
    check (status in ('upcoming', 'due_soon', 'overdue', 'paid', 'snoozed')),
  reminder_offsets int[] not null default '{7,3,1}',
  snoozed_until date,
  created_at timestamptz not null default now()
);

create index if not exists bills_user_id_idx on public.bills (user_id);

-- ---------------------------------------------------------------------------
-- Auto-create a profile row when a new auth user signs up
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.bills enable row level security;

-- profiles: a user can only see and edit their own row
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- bills: a user can only see and edit their own bills
drop policy if exists bills_select_own on public.bills;
create policy bills_select_own on public.bills
  for select using (auth.uid() = user_id);

drop policy if exists bills_insert_own on public.bills;
create policy bills_insert_own on public.bills
  for insert with check (auth.uid() = user_id);

drop policy if exists bills_update_own on public.bills;
create policy bills_update_own on public.bills
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists bills_delete_own on public.bills;
create policy bills_delete_own on public.bills
  for delete using (auth.uid() = user_id);
