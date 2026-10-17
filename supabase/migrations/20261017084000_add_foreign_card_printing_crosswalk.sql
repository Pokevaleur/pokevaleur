alter table public.collection_cards
  add column if not exists edition_market_code text;

create table if not exists public.foreign_card_sets (
  id uuid primary key default gen_random_uuid(),
  catalog_set_id uuid references public.card_sets(id) on delete set null,
  language_code text not null,
  market_code text not null,
  series_name text not null,
  set_name text not null,
  set_code text,
  release_date date,
  source_name text,
  source_url text,
  validation_status text not null default 'candidate'
    check (validation_status in ('candidate', 'verified', 'rejected')),
  created_at timestamptz not null default now(),
  constraint foreign_card_sets_identity_unique unique (language_code, market_code, set_code, set_name)
);

create table if not exists public.foreign_card_printings (
  id uuid primary key default gen_random_uuid(),
  foreign_set_id uuid not null references public.foreign_card_sets(id) on delete cascade,
  catalog_card_id uuid not null references public.cards(id) on delete cascade,
  collector_number text not null,
  card_name text not null,
  source_name text,
  source_url text,
  validation_status text not null default 'candidate'
    check (validation_status in ('candidate', 'verified', 'rejected')),
  created_at timestamptz not null default now(),
  constraint foreign_card_printing_identity_unique unique (foreign_set_id, catalog_card_id, collector_number)
);

create index if not exists foreign_card_sets_catalog_set_idx
  on public.foreign_card_sets(catalog_set_id);
create index if not exists foreign_card_printings_catalog_card_idx
  on public.foreign_card_printings(catalog_card_id);
create index if not exists foreign_card_printings_set_idx
  on public.foreign_card_printings(foreign_set_id);

alter table public.foreign_card_sets enable row level security;
alter table public.foreign_card_printings enable row level security;

grant select on public.foreign_card_sets, public.foreign_card_printings to anon, authenticated;

create policy "Foreign card set mappings are readable"
  on public.foreign_card_sets for select to anon, authenticated using (true);
create policy "Foreign card printing mappings are readable"
  on public.foreign_card_printings for select to anon, authenticated using (true);

insert into public.foreign_card_sets (
  catalog_set_id, language_code, market_code, series_name, set_name, set_code,
  release_date, source_name, source_url, validation_status
)
select cs.id, 'JP', 'JP', 'Sword & Shield (S)', 'Pokémon GO', 'S10b',
  date '2022-06-17', 'Pokécardex', 'https://www.pokecardex.com/checklist/jp/S10B', 'verified'
from public.card_sets cs
where cs.language = 'FR'
  and cs.set_name = 'Pokémon GO'
  and cs.set_code = 'swsh10.5'
  and not exists (
    select 1 from public.foreign_card_sets fcs
    where fcs.language_code = 'JP'
      and fcs.market_code = 'JP'
      and fcs.set_code = 'S10b'
  );

insert into public.foreign_card_printings (
  foreign_set_id, catalog_card_id, collector_number, card_name,
  source_name, source_url, validation_status
)
select fcs.id, c.id, '011/071', 'かがやくリザードン',
  'Pokécardex', 'https://www.pokecardex.com/checklist/jp/S10B', 'verified'
from public.foreign_card_sets fcs
join public.card_sets frs on frs.id = fcs.catalog_set_id
join public.cards c on c.card_set_id = frs.id
where fcs.language_code = 'JP'
  and fcs.market_code = 'JP'
  and fcs.set_code = 'S10b'
  and frs.language = 'FR'
  and frs.set_name = 'Pokémon GO'
  and c.card_name = 'Dracaufeu Radieux'
  and c.collector_number = '011'
  and not exists (
    select 1 from public.foreign_card_printings fcp
    where fcp.foreign_set_id = fcs.id
      and fcp.catalog_card_id = c.id
      and fcp.collector_number = '011/071'
  );
