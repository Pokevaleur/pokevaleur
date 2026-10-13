-- Track the eight SVE basic energies with the striated reverse-holo finish
-- released alongside EV10.5 as a distinct checklist from the original SVE set.

do $$
declare
  energy_set_id uuid;
  actual_cards integer;
begin
  if exists (
    select 1 from public.card_sets
    where language = 'FR'
      and set_code = 'sv10.5e'
      and set_name <> 'Énergies de base · EV10.5'
  ) then
    raise exception 'French set code sv10.5e is already used by another set';
  end if;

  insert into public.card_sets (
    series_name, set_name, set_code, language, release_date,
    advertised_card_count, checklist_source_url, checklist_scope_note, is_public
  ) values (
    'Écarlate et Violet',
    'Énergies de base · EV10.5',
    'sv10.5e',
    'FR',
    date '2025-07-18',
    8,
    'https://www.parkage.com/fr/1101361-energie-plante-de-base',
    'Réimpressions françaises des Énergies de base SVE FR 017–024, distribuées avec Foudre Noire et Flamme Blanche (EV10.5), en finition holographique striée. Mini-checklist dédiée pour distinguer ces tirages du set Écarlate et Violet Énergie d’origine.',
    true
  )
  on conflict (set_name, language) do update
    set series_name = excluded.series_name,
        set_code = excluded.set_code,
        release_date = excluded.release_date,
        advertised_card_count = excluded.advertised_card_count,
        checklist_source_url = excluded.checklist_source_url,
        checklist_scope_note = excluded.checklist_scope_note,
        is_public = excluded.is_public;

  select id into energy_set_id
  from public.card_sets
  where set_code = 'sv10.5e'
    and set_name = 'Énergies de base · EV10.5'
    and language = 'FR';

  if energy_set_id is null then
    raise exception 'French EV10.5 energy set could not be created';
  end if;

  insert into public.cards (
    card_set_id, collector_number, card_name, card_type, rarity_label,
    guide_order, image_url, image_source_url, source_url, element_types
  ) values
    (energy_set_id, '017', 'Énergie Plante de base', 'Énergie', 'Commune', 1,
      'https://assets.tcgdex.net/fr/sv/sve/17/low.webp',
      'https://api.tcgdex.net/v2/fr/sets/sve/017',
      'https://www.parkage.com/fr/1101361-energie-plante-de-base', array['Plante']::text[]),
    (energy_set_id, '018', 'Énergie Feu de base', 'Énergie', 'Commune', 2,
      'https://assets.tcgdex.net/fr/sv/sve/18/low.webp',
      'https://api.tcgdex.net/v2/fr/sets/sve/018',
      'https://www.parkage.com/fr/1101361-energie-plante-de-base', array['Feu']::text[]),
    (energy_set_id, '019', 'Énergie Eau de base', 'Énergie', 'Commune', 3,
      'https://assets.tcgdex.net/fr/sv/sve/19/low.webp',
      'https://api.tcgdex.net/v2/fr/sets/sve/019',
      'https://www.parkage.com/fr/1101361-energie-plante-de-base', array['Eau']::text[]),
    (energy_set_id, '020', 'Énergie Électrique de base', 'Énergie', 'Commune', 4,
      'https://assets.tcgdex.net/fr/sv/sve/20/low.webp',
      'https://api.tcgdex.net/v2/fr/sets/sve/020',
      'https://www.parkage.com/fr/1101361-energie-plante-de-base', array['Électrique']::text[]),
    (energy_set_id, '021', 'Énergie Psy de base', 'Énergie', 'Commune', 5,
      'https://assets.tcgdex.net/fr/sv/sve/21/low.webp',
      'https://api.tcgdex.net/v2/fr/sets/sve/021',
      'https://www.parkage.com/fr/1101361-energie-plante-de-base', array['Psy']::text[]),
    (energy_set_id, '022', 'Énergie Combat de base', 'Énergie', 'Commune', 6,
      'https://assets.tcgdex.net/fr/sv/sve/22/low.webp',
      'https://api.tcgdex.net/v2/fr/sets/sve/022',
      'https://www.parkage.com/fr/1101361-energie-plante-de-base', array['Combat']::text[]),
    (energy_set_id, '023', 'Énergie Obscurité de base', 'Énergie', 'Commune', 7,
      'https://assets.tcgdex.net/fr/sv/sve/23/low.webp',
      'https://api.tcgdex.net/v2/fr/sets/sve/023',
      'https://www.parkage.com/fr/1101361-energie-plante-de-base', array['Obscurité']::text[]),
    (energy_set_id, '024', 'Énergie Métal de base', 'Énergie', 'Commune', 8,
      'https://assets.tcgdex.net/fr/sv/sve/24/low.webp',
      'https://api.tcgdex.net/v2/fr/sets/sve/024',
      'https://www.parkage.com/fr/1101361-energie-plante-de-base', array['Métal']::text[])
  on conflict (card_set_id, collector_number) do update
    set card_name = excluded.card_name,
        card_type = excluded.card_type,
        rarity_label = excluded.rarity_label,
        guide_order = excluded.guide_order,
        image_url = excluded.image_url,
        image_source_url = excluded.image_source_url,
        source_url = excluded.source_url,
        element_types = excluded.element_types;

  insert into public.card_print_variants (
    card_id, variant_key, variant_label, finish_code,
    checklist_group, is_master_set_target
  )
  select c.id, 'holo_striee_ev10_5', 'Holo striée · EV10.5', 'reverse', 'main', true
  from public.cards c
  where c.card_set_id = energy_set_id
    and c.collector_number between '017' and '024'
  on conflict (card_id, variant_key) do update
    set variant_label = excluded.variant_label,
        finish_code = excluded.finish_code,
        checklist_group = excluded.checklist_group,
        is_master_set_target = excluded.is_master_set_target;

  select count(*)::integer into actual_cards
  from public.cards c
  join public.card_print_variants v on v.card_id = c.id
  where c.card_set_id = energy_set_id
    and c.collector_number between '017' and '024'
    and v.variant_key = 'holo_striee_ev10_5'
    and v.finish_code = 'reverse'
    and v.is_master_set_target;

  if actual_cards <> 8 then
    raise exception 'Expected eight EV10.5 striated holo energies, found %', actual_cards;
  end if;
end;
$$;
