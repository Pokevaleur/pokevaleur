-- PokéValeur member progression foundation
-- Run in Supabase SQL editor before enabling persistent XP in the UI.

create table if not exists public.member_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  streak_days integer not null default 0 check (streak_days >= 0),
  last_active_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.member_badges (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_key text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_key)
);

create table if not exists public.chest_openings (
  user_id uuid not null references auth.users(id) on delete cascade,
  opened_on date not null,
  reward_key text not null,
  reward_type text not null,
  xp_awarded integer not null default 0 check (xp_awarded >= 0),
  partner_code text,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, opened_on)
);

alter table public.member_progress enable row level security;
alter table public.member_badges enable row level security;
alter table public.chest_openings enable row level security;

create policy "members read own progress" on public.member_progress for select using (auth.uid() = user_id);
create policy "members read own badges" on public.member_badges for select using (auth.uid() = user_id);
create policy "members read own chest history" on public.chest_openings for select using (auth.uid() = user_id);

-- XP, badges and partner rewards should be awarded server-side only.
-- Do not add client INSERT/UPDATE policies for these tables.
