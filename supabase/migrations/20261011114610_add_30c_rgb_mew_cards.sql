-- Add the three unnumbered RGB Rare Mew cards in the French 30C checklist.
-- They are listed before card 001 and count toward the 161-card collector list.
-- Sources: https://www.pokemon-france.com/tcg-extension/30e-anniversaire/
-- https://www.pokemon-france.com/cartes-tcg/30c-g-rgb-mew/
-- https://www.pokemon-france.com/cartes-tcg/30c-r-rgb-mew/
-- https://www.pokemon-france.com/cartes-tcg/30c-b-rgb-mew/

do $$
declare
  target_set_id uuid;
  numbered_cards integer;
  rgb_cards integer;
begin
  select id into target_set_id
  from public.card_sets
  where set_code = '30C' and language = 'FR' and set_name = '30ᵉ Anniversaire'
  limit 1;

  if target_set_id is null then
    raise exception 'French 30C set was not found';
  end if;

  select count(*)::integer into numbered_cards
  from public.cards
  where card_set_id = target_set_id and collector_number ~ '^[0-9]+$';

  if numbered_cards <> 158 then
    raise exception 'Expected 158 numbered 30C cards before adding RGB Mew, found %', numbered_cards;
  end if;

  -- Keep checklist order stable and place G, R, B before the numbered cards.
  update public.cards
  set guide_order = collector_number::integer + 3
  where card_set_id = target_set_id
    and collector_number ~ '^[0-9]+$';

  insert into public.cards (
    card_set_id,
    collector_number,
    card_name,
    card_type,
    guide_category_label,
    guide_category_code,
    rarity_label,
    guide_order,
    image_url,
    image_source_url,
    source_url,
    element_types
  )
  values
    (
      target_set_id, 'G/RGB', 'Mew', 'Pokémon', 'RGB rare', 'rgb_rare',
      'RGB rare', 1,
      'https://cdn.pokemon-france.com/wp-content/uploads/2026/10/82916.webp',
      'https://www.pokemon-france.com/cartes-tcg/30c-g-rgb-mew/',
      'https://www.pokemon-france.com/cartes-tcg/30c-g-rgb-mew/', array['Psy']::text[]
    ),
    (
      target_set_id, 'R/RGB', 'Mew', 'Pokémon', 'RGB rare', 'rgb_rare',
      'RGB rare', 2,
      'https://cdn.pokemon-france.com/wp-content/uploads/2026/10/82915.webp',
      'https://www.pokemon-france.com/cartes-tcg/30c-r-rgb-mew/',
      'https://www.pokemon-france.com/cartes-tcg/30c-r-rgb-mew/', array['Psy']::text[]
    ),
    (
      target_set_id, 'B/RGB', 'Mew', 'Pokémon', 'RGB rare', 'rgb_rare',
      'RGB rare', 3,
      'https://cdn.pokemon-france.com/wp-content/uploads/2026/10/82917.webp',
      'https://www.pokemon-france.com/cartes-tcg/30c-b-rgb-mew/',
      'https://www.pokemon-france.com/cartes-tcg/30c-b-rgb-mew/', array['Psy']::text[]
    )
  on conflict (card_set_id, collector_number) do update
    set card_name = excluded.card_name,
        card_type = excluded.card_type,
        guide_category_label = excluded.guide_category_label,
        guide_category_code = excluded.guide_category_code,
        rarity_label = excluded.rarity_label,
        guide_order = excluded.guide_order,
        image_url = excluded.image_url,
        image_source_url = excluded.image_source_url,
        source_url = excluded.source_url,
        element_types = excluded.element_types;

  select count(*)::integer into rgb_cards
  from public.cards
  where card_set_id = target_set_id
    and collector_number in ('G/RGB', 'R/RGB', 'B/RGB')
    and card_name = 'Mew'
    and rarity_label = 'RGB rare';

  if rgb_cards <> 3 then
    raise exception 'Expected three 30C RGB Mew cards, found %', rgb_cards;
  end if;

  insert into public.card_print_variants (
    card_id,
    variant_key,
    variant_label,
    finish_code,
    checklist_group,
    is_master_set_target
  )
  select c.id, 'holo', 'Holo', 'holo', 'main', true
  from public.cards c
  where c.card_set_id = target_set_id
    and c.collector_number in ('G/RGB', 'R/RGB', 'B/RGB')
  on conflict (card_id, variant_key) do update
    set variant_label = excluded.variant_label,
        finish_code = excluded.finish_code,
        checklist_group = excluded.checklist_group,
        is_master_set_target = excluded.is_master_set_target;
end;
$$;
