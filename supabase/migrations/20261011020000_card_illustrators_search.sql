create table if not exists public.illustrators (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.card_illustrators (
  card_id uuid not null references public.cards(id) on delete cascade,
  illustrator_id uuid not null references public.illustrators(id) on delete cascade,
  source_url text,
  verified_at timestamptz,
  primary key (card_id, illustrator_id)
);

create index if not exists card_illustrators_illustrator_id_idx
  on public.card_illustrators (illustrator_id);

alter table public.illustrators enable row level security;
alter table public.card_illustrators enable row level security;

grant select on public.illustrators to anon, authenticated;
grant select on public.card_illustrators to anon, authenticated;

drop policy if exists "Public cards expose illustrator names" on public.illustrators;
create policy "Public cards expose illustrator names"
  on public.illustrators for select to anon, authenticated
  using (exists (
    select 1
    from public.card_illustrators ci
    join public.cards c on c.id = ci.card_id
    join public.card_sets s on s.id = c.card_set_id
    where ci.illustrator_id = illustrators.id
      and s.is_public = true
  ));

drop policy if exists "Public cards expose illustrator links" on public.card_illustrators;
create policy "Public cards expose illustrator links"
  on public.card_illustrators for select to anon, authenticated
  using (exists (
    select 1
    from public.cards c
    join public.card_sets s on s.id = c.card_set_id
    where c.id = card_illustrators.card_id
      and s.is_public = true
  ));