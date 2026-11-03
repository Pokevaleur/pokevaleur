do $migration$
declare
  set_id uuid;
  inserted_cards integer;
  inserted_variants integer;
begin
  select id into set_id
  from public.card_sets
  where set_code = 'mep' and language = 'FR'
  order by created_at
  limit 1;

  if set_id is null then
    raise exception 'French MEP promo set not found';
  end if;

  insert into public.cards (
    card_set_id, collector_number, card_name, card_type, rarity_label,
    mechanic_label, guide_order, element_types, image_url, image_source_url, source_url
  )
  select
    set_id,
    x.collector_number,
    x.card_name,
    x.card_type,
    'Promo',
    x.mechanic_label,
    x.guide_order,
    x.element_types,
    'https://assets.tcgdex.net/fr/me/mep/' || x.collector_number || '/low.webp',
    'https://api.tcgdex.net/v2/fr/sets/mep/' || x.collector_number,
    'https://api.tcgdex.net/v2/fr/sets/mep/' || x.collector_number
  from (values
    ('089','Méga-Zeraora-ex','Pokémon','ex',89,array['Électrik']::text[]),
    ('090','Méga-Darkrai-ex','Pokémon','ex',90,array['Obscurité']::text[]),
    ('091','Méga-Dracolosse-ex','Pokémon','ex',91,array['Dragon']::text[]),
    ('092','Hôtel « Au paradis des Pokémon »','Dresseur',null,92,array[]::text[]),
    ('094','Noadkoko d''Alola','Pokémon',null,94,array['Plante']::text[]),
    ('095','Lucario','Pokémon',null,95,array['Combat']::text[]),
    ('096','Sulfura','Pokémon',null,96,array['Feu']::text[]),
    ('097','Artikodin','Pokémon',null,97,array['Eau']::text[]),
    ('098','Électhor','Pokémon',null,98,array['Électrik']::text[]),
    ('099','Amphinobi-ex','Pokémon','ex',99,array['Eau']::text[]),
    ('100','Nymphali-ex','Pokémon','ex',100,array['Psy']::text[]),
    ('101','Nidorina','Pokémon',null,101,array['Obscurité']::text[]),
    ('102','Victini','Pokémon',null,102,array['Feu']::text[]),
    ('103','Zeraora','Pokémon',null,103,array['Électrik']::text[])
  ) as x(collector_number,card_name,card_type,mechanic_label,guide_order,element_types)
  where not exists (
    select 1 from public.cards c
    where c.card_set_id = set_id and c.collector_number = x.collector_number
  )
  on conflict (card_set_id, collector_number) do nothing;

  get diagnostics inserted_cards = row_count;

  insert into public.card_print_variants (
    card_id, variant_key, variant_label, finish_code, checklist_group, is_master_set_target
  )
  select c.id, 'catalog_base', 'Carte (suivi de base)', 'unclassified', 'main', true
  from public.cards c
  where c.card_set_id = set_id
    and c.collector_number in ('089','090','091','092','094','095','096','097','098','099','100','101','102','103')
    and not exists (
      select 1 from public.card_print_variants v
      where v.card_id = c.id and v.variant_key = 'catalog_base'
    )
  on conflict (card_id, variant_key) do nothing;

  get diagnostics inserted_variants = row_count;

  insert into public.card_price_observations (
    card_print_variant_id, price_kind, observation_type, amount, currency, source, source_url, observed_at
  )
  select
    v.id, 'raw', 'estimate', p.amount, 'EUR', p.source, p.source_url, timestamptz '2026-11-03 00:00:00+00'
  from (values
    ('089',1.05::numeric,'Pokoya · tendance Cardmarket, relevé 31/10/2026','https://pokoya.app/carte/mep-black-star-promos/091-mega-dracolosse-ex'),
    ('090',0.94::numeric,'Pokoya · tendance Cardmarket, relevé 31/10/2026','https://pokoya.app/carte/mep-black-star-promos/091-mega-dracolosse-ex'),
    ('091',1.64::numeric,'Pokoya · Cardmarket FR, relevé 31/10/2026','https://pokoya.app/carte/mep-black-star-promos/091-mega-dracolosse-ex'),
    ('092',123.81::numeric,'Pokoya · prix Cardmarket FR, relevé 01/11/2026','https://pokoya.app/carte/mep-black-star-promos/092-paradise-resort'),
    ('094',0.49::numeric,'Cardmarket · tendance, relevé 02/11/2026','https://www.cardmarket.com/fr/Pokemon/Products/Singles/MEP-Black-Star-Promos/Alolan-Exeggutor-MEP094'),
    ('095',0.50::numeric,'Cardmarket · moyenne 30 jours, relevé 02/11/2026','https://pokebuck.com/en/cards/mep-black-star-promos/095-lucario'),
    ('096',0.25::numeric,'Cardmarket · tendance, relevé 02/11/2026','https://www.getmint.app/cards/moltres-mep-black-star-promos-MEP_096/'),
    ('097',0.27::numeric,'Cardmarket · tendance, relevé 02/11/2026','https://www.getmint.app/cards/articuno-mep-black-star-promos-MEP_097/'),
    ('098',0.27::numeric,'Cardmarket · tendance, relevé 03/11/2026','https://holotrends.com/pokemon/name/zapdos/'),
    ('099',2.23::numeric,'Project151 · cote Cardmarket/eBay, relevé 03/11/2026','https://project151.fr/cartes-pokemon/mep'),
    ('100',2.25::numeric,'Project151 · cote Cardmarket/eBay, relevé 03/11/2026','https://project151.fr/cartes-pokemon/mep'),
    ('101',4.25::numeric,'Cardmarket · tendance, relevé 03/11/2026','https://www.getmint.app/cards/nidorina-mep-black-star-promos-MEP_101/'),
    ('102',33.49::numeric,'Project151 · cote Cardmarket/eBay, relevé 03/11/2026','https://project151.fr/cartes-pokemon/mep'),
    ('103',37.50::numeric,'Project151 · cote Cardmarket/eBay, relevé 03/11/2026','https://project151.fr/cartes-pokemon/mep')
  ) as p(collector_number,amount,source,source_url)
  join public.cards c
    on c.card_set_id = set_id and c.collector_number = p.collector_number
  join public.card_print_variants v
    on v.card_id = c.id and v.variant_key = 'catalog_base'
  where not exists (
    select 1 from public.card_price_observations o
    where o.card_print_variant_id = v.id
      and o.price_kind = 'raw'
      and o.observation_type = 'estimate'
      and o.source = p.source
      and o.observed_at = timestamptz '2026-11-03 00:00:00+00'
  );

  update public.card_sets
  set advertised_card_count = case when advertised_card_count = 88 then 109 else advertised_card_count end,
      checklist_scope_note = concat_ws(
        E'\n',
        nullif(checklist_scope_note, ''),
        'Mise à jour du 3 novembre 2026 : 14 promos françaises manquantes ajoutées (MEP 089–092 et 094–103), avec visuels TCGdex et estimations de marché sourcées. Le MEP 093 n’a pas de version française répertoriée. Les promos 104–109 sont annoncées pour le 6 novembre 2026 et attendent leur sortie.'
      )
  where id = set_id
    and (checklist_scope_note is null or checklist_scope_note not like '%Mise à jour du 3 novembre 2026:%');

  if inserted_cards not in (0,14) or inserted_variants not in (0,14) then
    raise exception 'Unexpected insertion count: cards %, variants %', inserted_cards, inserted_variants;
  end if;
end;
$migration$;