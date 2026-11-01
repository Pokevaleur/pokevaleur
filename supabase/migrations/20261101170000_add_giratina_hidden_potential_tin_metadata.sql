do $$
declare
  target_count integer;
begin
  select count(*)::integer into target_count
  from public.products
  where name = 'Pokébox Potentiel Caché – Giratina-V'
    and category = 'sealed'
    and product_type = 'Pokébox'
    and series = 'Épée et Bouclier – Origine Perdue';

  if target_count <> 1 then
    raise exception 'Expected one public Giratina-V Hidden Potential Pokébox, found %', target_count;
  end if;
end;
$$;

-- Fill only the missing French release date; retain any existing catalog value.
update public.products
set release_date = '2022-10-14'
where name = 'Pokébox Potentiel Caché – Giratina-V'
  and category = 'sealed'
  and product_type = 'Pokébox'
  and series = 'Épée et Bouclier – Origine Perdue'
  and release_date is null;

-- Record only the verified guaranteed promo and booster composition not already present.
with target as (
  select p.id as product_id
  from public.products p
  where p.name = 'Pokébox Potentiel Caché – Giratina-V'
    and p.category = 'sealed'
    and p.product_type = 'Pokébox'
    and p.series = 'Épée et Bouclier – Origine Perdue'
), contents(content_type, item_name, quantity, card_id) as (
  select
    'promo',
    'Giratina-V (carte promo brillante · SWSHP 259)',
    1,
    c.id
  from public.cards c
  join public.card_sets s on s.id = c.card_set_id
  where s.set_code = 'swshp'
    and s.language = 'FR'
    and c.collector_number = 'SWSH259'
    and c.card_name ilike 'Giratina V'
  union all
  select 'booster', 'Origine Perdue', 2, null::uuid
  union all
  select 'booster', 'Poing de Fusion', 2, null::uuid
)
insert into public.product_contents (
  product_id, content_type, item_name, quantity, source_url, source_label, confidence, card_id, content_role
)
select
  target.product_id,
  contents.content_type,
  contents.item_name,
  contents.quantity,
  'https://www.pokecardex.com/forums/viewtopic.php?t=45035',
  'Pokécardex — calendrier français des sorties JCC Pokémon 2022',
  'verified',
  contents.card_id,
  'guaranteed'
from target
cross join contents
where not exists (
  select 1
  from public.product_contents existing
  where existing.product_id = target.product_id
    and existing.content_type = contents.content_type
    and existing.item_name = contents.item_name
    and existing.content_role = 'guaranteed'
);
