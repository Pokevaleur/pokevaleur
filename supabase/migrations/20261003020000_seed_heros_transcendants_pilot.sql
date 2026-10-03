-- First verified catalogue record for the French Mega Evolution — Ascended Heroes set.
-- Keep the set private until its complete guide checklist and variants are reviewed.

with set_row as (
  insert into public.card_sets (
    series_name,
    set_name,
    set_code,
    language,
    release_date,
    checklist_source_url,
    checklist_scope_note,
    is_public
  )
  values (
    'Méga-Évolution',
    'Méga-Évolution – Héros Transcendants',
    'ME2pt5',
    'FR',
    date '2026-01-30',
    'https://www.pokemon.com/fr/jcc-pokemon/cartes-pokemon/series/me2pt5/280',
    'Import pilote : carte officielle 280/217 vérifiée. Série masquée jusqu’à vérification de la checklist complète, des variantes parallèles et des promos.',
    false
  )
  on conflict (set_name, language) do update
    set series_name = excluded.series_name,
        set_code = excluded.set_code,
        release_date = excluded.release_date,
        checklist_source_url = excluded.checklist_source_url,
        checklist_scope_note = excluded.checklist_scope_note
  returning id
),
card_row as (
  insert into public.cards (
    card_set_id,
    collector_number,
    card_name,
    card_type,
    guide_category_label,
    guide_category_code,
    rarity_label,
    mechanic_label,
    illustration_style,
    guide_order,
    source_url
  )
  select
    id,
    '280/217',
    'Mélofée ex de Lilie',
    'Pokémon',
    'Illustration spéciale rare',
    'sir',
    'Illustration spéciale rare',
    'ex',
    'Special Illustration Rare',
    280,
    'https://www.pokemon.com/fr/jcc-pokemon/cartes-pokemon/series/me2pt5/280'
  from set_row
  on conflict (card_set_id, collector_number) do update
    set card_name = excluded.card_name,
        card_type = excluded.card_type,
        guide_category_label = excluded.guide_category_label,
        guide_category_code = excluded.guide_category_code,
        rarity_label = excluded.rarity_label,
        mechanic_label = excluded.mechanic_label,
        illustration_style = excluded.illustration_style,
        guide_order = excluded.guide_order,
        source_url = excluded.source_url
  returning id
)
insert into public.card_print_variants (
  card_id,
  variant_key,
  variant_label,
  finish_code,
  guide_marker,
  checklist_group,
  is_master_set_target
)
select
  id,
  'holo',
  'Holo',
  'holo',
  'Illustration spéciale rare',
  'main',
  true
from card_row
on conflict (card_id, variant_key) do update
  set variant_label = excluded.variant_label,
      finish_code = excluded.finish_code,
      guide_marker = excluded.guide_marker,
      checklist_group = excluded.checklist_group,
      is_master_set_target = excluded.is_master_set_target;
