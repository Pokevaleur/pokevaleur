-- Add the sealed display format separately from individual prerelease kits.
-- Do not replace existing products or collection items; only insert missing displays.
with canonical_kits as (
  select distinct on (p.series)
    p.id as kit_id,
    p.series,
    p.release_year
  from public.products p
  where p.product_type in ('Kit Avant-première', 'Build & Battle')
    and p.series is not null
  order by
    p.series,
    (p.product_type = 'Kit Avant-première') desc,
    p.release_year desc,
    p.name
), inserted_displays as (
  insert into public.products (
    name,
    category,
    series,
    currency,
    is_public,
    language,
    product_type,
    release_year,
    case_unit_product_id,
    case_unit_count,
    case_packaging_note,
    official_source_url
  )
  select
    'Display de 10 Kits AP – ' || k.series,
    'sealed',
    k.series,
    'EUR',
    true,
    'FR',
    'Display de Kits AP',
    k.release_year,
    k.kit_id,
    10,
    'Contient 10 Kits AP. Chaque kit contient 4 boosters, soit 40 boosters au total.',
    'https://support.play.pokemon.com/hc/en-us/articles/33928369145364-Prerelease-Kit-Contents'
  from canonical_kits k
  where not exists (
    select 1
    from public.products existing
    where existing.series = k.series
      and existing.product_type = 'Display de Kits AP'
  )
  returning id, series
)
insert into public.product_contents (
  product_id,
  content_type,
  item_name,
  quantity,
  source_url,
  source_label,
  confidence,
  content_role
)
select
  d.id,
  'other',
  'Kit AP – ' || d.series || ' (4 boosters)',
  10,
  'https://support.play.pokemon.com/hc/en-us/articles/33928369145364-Prerelease-Kit-Contents',
  'Play! Pokémon – Prerelease Kit Contents',
  'verified',
  'guaranteed'
from inserted_displays d;
