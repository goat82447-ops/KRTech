create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  topic text not null,
  question text not null,
  answer text not null,
  example text not null,
  access_level text check (access_level in ('L1', 'L2', 'L3')),
  is_free boolean not null default false,
  unique (company, topic, question)
);

create index if not exists questions_topic_free_idx
  on public.questions(topic, is_free, company);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tier text not null check (tier in ('L1', 'L2', 'L3', 'Pro')),
  provider text not null check (provider in ('razorpay', 'stripe', 'paypal')),
  provider_reference text unique,
  status text not null check (status in ('pending', 'paid', 'failed')),
  amount_minor integer not null,
  currency text not null check (currency in ('INR', 'USD')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tier text not null check (tier in ('L1', 'L2', 'L3', 'Pro')),
  active boolean not null default true,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  payment_id uuid unique references public.payments(id),
  unique (user_id, tier)
);

create or replace function public.create_profile_for_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.complete_verified_payment(
  p_provider text,
  p_provider_reference text,
  p_payment_id uuid,
  p_tier text,
  p_user_id uuid,
  p_amount_minor integer,
  p_currency text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  purchase public.payments%rowtype;
begin
  select * into purchase
  from public.payments
  where id = p_payment_id
    and provider = p_provider
    and provider_reference = p_provider_reference
  for update;

  if not found
    or purchase.id <> p_payment_id
    or purchase.user_id <> p_user_id
    or purchase.tier <> p_tier
    or purchase.amount_minor <> p_amount_minor
    or purchase.currency <> p_currency then
    raise exception 'Verified payment does not match the pending purchase';
  end if;

  if purchase.status = 'paid' then
    return;
  end if;
  if purchase.status <> 'pending' then
    raise exception 'Purchase is not pending';
  end if;

  update public.payments
  set status = 'paid', paid_at = now()
  where id = purchase.id;

  insert into public.entitlements (
    user_id, tier, active, granted_at, revoked_at, payment_id
  ) values (
    p_user_id, p_tier, true, now(), null, purchase.id
  )
  on conflict (user_id, tier) do update
  set active = true,
      granted_at = now(),
      revoked_at = null,
      payment_id = excluded.payment_id;
end;
$$;

drop trigger if exists create_profile_after_signup on auth.users;
create trigger create_profile_after_signup
  after insert on auth.users
  for each row execute procedure public.create_profile_for_user();

alter table public.profiles enable row level security;
alter table public.questions enable row level security;
alter table public.payments enable row level security;
alter table public.entitlements enable row level security;

revoke all on public.profiles, public.questions, public.payments, public.entitlements from anon, authenticated;
grant all on public.profiles, public.questions, public.payments, public.entitlements to service_role;
revoke all on function public.create_profile_for_user() from public, anon, authenticated;
revoke all on function public.complete_verified_payment(text, text, uuid, text, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.complete_verified_payment(text, text, uuid, text, uuid, integer, text) to service_role;
