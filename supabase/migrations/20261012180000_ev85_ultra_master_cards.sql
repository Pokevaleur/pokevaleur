-- EV 8.5 Ultra Master Set: keep the Pokémon Day stamped print and SVP promo cards outside the Master Set.
begin;

create table if not exists public.card_set_bonus_cards (
  card_set_id uuid not null references public.card_sets(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete restrict,
  category text not null check (category in ('promo', 'stamp')),
  source_label text not null,
  created_at timestamptz not null default now(),
  primary key (card_set_id, card_id, category)
);

alter table public.card_set_bonus_cards enable row level security;
grant select on public.card_set_bonus_cards to anon, authenticated;

drop policy if exists "Published bonus cards are readable" on public.card_set_bonus_cards;
create policy "Published bonus cards are readable"
  on public.card_set_bonus_cards
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.card_sets target_set
      where target_set.id = card_set_id and target_set.is_public = true
    )
    and exists (
      select 1
      from public.cards bonus_card
      join public.card_sets bonus_set on bonus_set.id = bonus_card.card_set_id
      where bonus_card.id = card_id and bonus_set.is_public = true
    )
  );

-- The existing reverse_cosmos row for Évoli 074 is the Pokémon Day stamp.
-- Updating the existing row preserves any collection ownership references.
update public.card_print_variants variant
set variant_key = 'stamp_pokemon_day',
    variant_label = 'Tampon Pokémon Day',
    checklist_group = 'stamp',
    is_master_set_target = false
from public.cards card
join public.card_sets card_set on card_set.id = card.card_set_id
where variant.card_id = card.id
  and card_set.language = 'FR'
  and lower(card_set.set_code) = 'sv08.5'
  and card.collector_number = '074'
  and variant.variant_key = 'reverse_cosmos';

-- Link the eight French SVP promo cards associated with Évolutions Prismatiques.
insert into public.card_set_bonus_cards (card_set_id, card_id, category, source_label)
select target.id, bonus.id, 'promo', 'Promo SVP ' || bonus.collector_number
from public.card_sets target
join public.card_sets promo_set on lower(promo_set.set_code) = 'svp' and promo_set.language = 'FR'
join public.cards bonus on bonus.card_set_id = promo_set.id
where lower(target.set_code) = 'sv08.5'
  and target.language = 'FR'
  and bonus.collector_number in ('167', '168', '169', '170', '171', '172', '173', '174')
on conflict (card_set_id, card_id, category) do update
set source_label = excluded.source_label;

do $$
declare
  promo_count integer;
  stamped_count integer;
begin
  select count(*) into promo_count
  from public.card_set_bonus_cards mapping
  join public.card_sets target on target.id = mapping.card_set_id
  join public.cards bonus on bonus.id = mapping.card_id
  join public.card_sets promo_set on promo_set.id = bonus.card_set_id
  where lower(target.set_code) = 'sv08.5'
    and target.language = 'FR'
    and lower(promo_set.set_code) = 'svp'
    and bonus.collector_number in ('167', '168', '169', '170', '171', '172', '173', '174')
    and mapping.category = 'promo';

  select count(*) into stamped_count
  from public.card_print_variants variant
  join public.cards card on card.id = variant.card_id
  join public.card_sets card_set on card_set.id = card.card_set_id
  where lower(card_set.set_code) = 'sv08.5'
    and card_set.language = 'FR'
    and card.collector_number = '074'
    and variant.variant_key = 'stamp_pokemon_day'
    and variant.checklist_group = 'stamp'
    and variant.is_master_set_target = false;

  if promo_count <> 8 or stamped_count <> 1 then
    raise exception 'EV 8.5 bonus catalogue incomplete (promos: %, stamps: %)', promo_count, stamped_count;
  end if;
end;
$$;

commit;
