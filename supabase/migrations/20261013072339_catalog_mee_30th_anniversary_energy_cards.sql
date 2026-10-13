-- Catalogue the eight MEE basic energies released for the 30th anniversary
-- as their own 2026 checklist, and point both MEE checklists at working scans.

do $$
declare
  anniversary_set_id uuid;
  actual_cards integer;
begin
  if exists (
    select 1 from public.card_sets
    where language = 'FR'
      and set_code = 'mee30'
      and set_name <> 'Méga-Évolution Énergie · 30ᵉ Anniversaire'
  ) then
    raise exception 'French set code mee30 is already used by another set';
  end if;

  insert into public.card_sets (
    series_name, set_name, set_code, language, release_date,
    advertised_card_count, checklist_source_url, checklist_scope_note, is_public
  ) values (
    'Méga-Évolution',
    'Méga-Évolution Énergie · 30ᵉ Anniversaire',
    'mee30',
    'FR',
    date '2026-09-16',
    8,
    'https://bulbapedia.bulbagarden.net/wiki/MEE',
    'Énergies de base MEE 009–016 avec tampon du 30ᵉ anniversaire. Une impression holographique par type, sans reverse. Sortie du 16 septembre 2026.',
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

  select id into anniversary_set_id
  from public.card_sets
  where set_code = 'mee30'
    and set_name = 'Méga-Évolution Énergie · 30ᵉ Anniversaire'
    and language = 'FR';

  if anniversary_set_id is null then
    raise exception 'French MEE 30th Anniversary set could not be created';
  end if;

  -- The older MEE cards were already in the catalog, but their image URLs no
  -- longer resolve in the collection checklist. Use the hosted PokeValue scans.
  update public.cards c
  set image_url = source.image_url,
      image_source_url = source.image_url,
      source_url = source.source_url
  from public.card_sets s,
       (values
         ('001', 'https://images-cartes.pokevalue.fr/images/pokemon/MEE/pokemon-serie-energies-mega-evolution-carte-energie-plante-de-base-numero-001.png.webp', 'https://www.pokevalue.fr/carte-pokemon/energies-mega-evolution/energie-plante-de-base-001'),
         ('002', 'https://images-cartes.pokevalue.fr/images/pokemon/MEE/pokemon-serie-energies-mega-evolution-carte-energie-feu-de-base-numero-002.png.webp', 'https://www.pokevalue.fr/carte-pokemon/energies-mega-evolution/energie-feu-de-base-002'),
         ('003', 'https://images-cartes.pokevalue.fr/images/pokemon/MEE/pokemon-serie-energies-mega-evolution-carte-energie-eau-de-base-numero-003.png.webp', 'https://www.pokevalue.fr/carte-pokemon/energies-mega-evolution/energie-eau-de-base-003'),
         ('004', 'https://images-cartes.pokevalue.fr/images/pokemon/MEE/pokemon-serie-energies-mega-evolution-carte-energie-electrique-de-base-numero-004.png.webp', 'https://www.pokevalue.fr/carte-pokemon/energies-mega-evolution/energie-electrique-de-base-004'),
         ('005', 'https://images-cartes.pokevalue.fr/images/pokemon/MEE/pokemon-serie-energies-mega-evolution-carte-energie-psy-de-base-numero-005.png.webp', 'https://www.pokevalue.fr/carte-pokemon/energies-mega-evolution/energie-psy-de-base-005'),
         ('006', 'https://images-cartes.pokevalue.fr/images/pokemon/MEE/pokemon-serie-energies-mega-evolution-carte-energie-combat-de-base-numero-006.png.webp', 'https://www.pokevalue.fr/carte-pokemon/energies-mega-evolution/energie-combat-de-base-006'),
         ('007', 'https://images-cartes.pokevalue.fr/images/pokemon/MEE/pokemon-serie-energies-mega-evolution-carte-energie-obscurite-de-base-numero-007.png.webp', 'https://www.pokevalue.fr/carte-pokemon/energies-mega-evolution/energie-obscurite-de-base-007'),
         ('008', 'https://images-cartes.pokevalue.fr/images/pokemon/MEE/pokemon-serie-energies-mega-evolution-carte-energie-metal-de-base-numero-008.png.webp', 'https://www.pokevalue.fr/carte-pokemon/energies-mega-evolution/energie-metal-de-base-008')
       ) as source(collector_number, image_url, source_url)
  where s.set_code = 'mee'
    and s.language = 'FR'
    and c.card_set_id = s.id
    and c.collector_number = source.collector_number;

  insert into public.cards (
    card_set_id, collector_number, card_name, card_type, rarity_label,
    guide_order, image_url, image_source_url, source_url, element_types
  )
  values
    (anniversary_set_id, '009', 'Énergie Plante de base 30 ans', 'Énergie', 'Commune', 1,
      'https://images-cartes.pokevalue.fr/images/pokemon/MEE/pokemon-serie-energies-mega-evolution-carte-energie-plante-de-base-30-ans-numero-009.png.webp',
      'https://images-cartes.pokevalue.fr/images/pokemon/MEE/pokemon-serie-energies-mega-evolution-carte-energie-plante-de-base-30-ans-numero-009.png.webp',
      'https://www.pokevalue.fr/carte-pokemon/energies-mega-evolution/energie-plante-de-base-30-ans-009', array['Plante']::text[]),
    (anniversary_set_id, '010', 'Énergie Feu de base 30 ans', 'Énergie', 'Commune', 2,
      'https://images-cartes.pokevalue.fr/images/pokemon/MEE/pokemon-serie-energies-mega-evolution-carte-energie-feu-de-base-30-ans-numero-010.png.webp',
      'https://images-cartes.pokevalue.fr/images/pokemon/MEE/pokemon-serie-energies-mega-evolution-carte-energie-feu-de-base-30-ans-numero-010.png.webp',
      'https://www.pokevalue.fr/carte-pokemon/energies-mega-evolution/energie-feu-de-base-30-ans-010', array['Feu']::text[]),
    (anniversary_set_id, '011', 'Énergie Eau de base 30 ans', 'Énergie', 'Commune', 3,
      'https://images-cartes.pokevalue.fr/images/pokemon/MEE/pokemon-serie-energies-mega-evolution-carte-energie-eau-de-base-30-ans-numero-011.png.webp',
      'https://images-cartes.pokevalue.fr/images/pokemon/MEE/pokemon-serie-energies-mega-evolution-carte-energie-eau-de-base-30-ans-numero-011.png.webp',
      'https://www.pokevalue.fr/carte-pokemon/energies-mega-evolution/energie-eau-de-base-30-ans-011', array['Eau']::text[]),
    (anniversary_set_id, '012', 'Énergie Électrique de base 30 ans', 'Énergie', 'Commune', 4,
      'https://images-cartes.pokevalue.fr/images/pokemon/MEE/pokemon-serie-energies-mega-evolution-carte-energie-electrique-de-base-30-ans-numero-012.png.webp',
      'https://images-cartes.pokevalue.fr/images/pokemon/MEE/pokemon-serie-energies-mega-evolution-carte-energie-electrique-de-base-30-ans-numero-012.png.webp',
      'https://www.pokevalue.fr/carte-pokemon/energies-mega-evolution/energie-electrique-de-base-30-ans-012', array['Électrique']::text[]),
    (anniversary_set_id, '013', 'Énergie Psy de base 30 ans', 'Énergie', 'Commune', 5,
      'https://images-cartes.pokevalue.fr/images/pokemon/MEE/pokemon-serie-energies-mega-evolution-carte-energie-psy-de-base-30-ans-numero-013.png.webp',
      'https://images-cartes.pokevalue.fr/images/pokemon/MEE/pokemon-serie-energies-mega-evolution-carte-energie-psy-de-base-30-ans-numero-013.png.webp',
      'https://www.pokevalue.fr/carte-pokemon/energies-mega-evolution/energie-psy-de-base-30-ans-013', array['Psy']::text[]),
    (anniversary_set_id, '014', 'Énergie Combat de base 30 ans', 'Énergie', 'Commune', 6,
      'https://images-cartes.pokevalue.fr/images/pokemon/MEE/pokemon-serie-energies-mega-evolution-carte-energie-combat-de-base-30-ans-numero-014.png.webp',
      'https://images-cartes.pokevalue.fr/images/pokemon/MEE/pokemon-serie-energies-mega-evolution-carte-energie-combat-de-base-30-ans-numero-014.png.webp',
      'https://www.pokevalue.fr/carte-pokemon/energies-mega-evolution/energie-combat-de-base-30-ans-014', array['Combat']::text[]),
    (anniversary_set_id, '015', 'Énergie Obscurité de base 30 ans', 'Énergie', 'Commune', 7,
      'https://images-cartes.pokevalue.fr/images/pokemon/MEE/pokemon-serie-energies-mega-evolution-carte-energie-obscurite-de-base-30-ans-numero-015.png.webp',
      'https://images-cartes.pokevalue.fr/images/pokemon/MEE/pokemon-serie-energies-mega-evolution-carte-energie-obscurite-de-base-30-ans-numero-015.png.webp',
      'https://www.pokevalue.fr/carte-pokemon/energies-mega-evolution/energie-obscurite-de-base-30-ans-015', array['Obscurité']::text[]),
    (anniversary_set_id, '016', 'Énergie Métal de base 30 ans', 'Énergie', 'Commune', 8,
      'https://images-cartes.pokevalue.fr/images/pokemon/MEE/pokemon-serie-energies-mega-evolution-carte-energie-metal-de-base-30-ans-numero-016.png.webp',
      'https://images-cartes.pokevalue.fr/images/pokemon/MEE/pokemon-serie-energies-mega-evolution-carte-energie-metal-de-base-30-ans-numero-016.png.webp',
      'https://www.pokevalue.fr/carte-pokemon/energies-mega-evolution/energie-metal-de-base-30-ans-016', array['Métal']::text[])
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
    card_id, variant_key, variant_label, finish_code, checklist_group, is_master_set_target
  )
  select c.id, 'holo', 'Holo · tampon 30ᵉ Anniversaire', 'holo', 'main', true
  from public.cards c
  where c.card_set_id = anniversary_set_id
    and c.collector_number between '009' and '016'
  on conflict (card_id, variant_key) do update
    set variant_label = excluded.variant_label,
        finish_code = excluded.finish_code,
        checklist_group = excluded.checklist_group,
        is_master_set_target = excluded.is_master_set_target;

  select count(*)::integer into actual_cards
  from public.cards c
  join public.card_print_variants v on v.card_id = c.id
  where c.card_set_id = anniversary_set_id
    and c.collector_number between '009' and '016'
    and c.image_url like 'https://images-cartes.pokevalue.fr/%'
    and v.variant_key = 'holo'
    and v.finish_code = 'holo';

  if actual_cards <> 8 then
    raise exception 'Expected eight illustrated holo MEE anniversary energies, found %', actual_cards;
  end if;
end;
$$;
