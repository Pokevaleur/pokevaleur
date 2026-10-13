-- Replace third-party watermarked scans for all Mega Evolution Energy cards
-- with the official French scans published by Pokémon's card database.
do $$
declare
  target_cards integer;
  verified_cards integer;
begin
  select count(*)::integer into target_cards
  from public.cards c
  join public.card_sets s on s.id = c.card_set_id
  where s.language = 'FR'
    and s.set_code in ('mee', 'mee30')
    and c.collector_number ~ '^[0-9]{3}$'
    and c.collector_number::integer between 1 and 16;

  if target_cards <> 16 then
    raise exception 'Expected 16 French MEE energy cards, found %', target_cards;
  end if;

  update public.cards c
  set image_url = 'https://assets.pokemon.com/static-assets/content-assets/cms2-fr-fr/img/cards/web/MEE/MEE_FR_'
        || c.collector_number::integer || '.png',
      image_source_url = 'https://assets.pokemon.com/static-assets/content-assets/cms2-fr-fr/img/cards/web/MEE/MEE_FR_'
        || c.collector_number::integer || '.png',
      source_url = 'https://www.pokemon.com/fr/jcc-pokemon/cartes-pokemon/series/mee/'
        || c.collector_number::integer
  from public.card_sets s
  where s.id = c.card_set_id
    and s.language = 'FR'
    and s.set_code in ('mee', 'mee30')
    and c.collector_number ~ '^[0-9]{3}$'
    and c.collector_number::integer between 1 and 16
    and c.image_url is distinct from (
      'https://assets.pokemon.com/static-assets/content-assets/cms2-fr-fr/img/cards/web/MEE/MEE_FR_'
      || c.collector_number::integer || '.png'
    );

  select count(*)::integer into verified_cards
  from public.cards c
  join public.card_sets s on s.id = c.card_set_id
  where s.language = 'FR'
    and s.set_code in ('mee', 'mee30')
    and c.collector_number ~ '^[0-9]{3}$'
    and c.collector_number::integer between 1 and 16
    and c.image_url = 'https://assets.pokemon.com/static-assets/content-assets/cms2-fr-fr/img/cards/web/MEE/MEE_FR_'
      || c.collector_number::integer || '.png';

  if verified_cards <> 16 then
    raise exception 'Expected 16 official French Pokémon scans, found %', verified_cards;
  end if;
end;
$$;
