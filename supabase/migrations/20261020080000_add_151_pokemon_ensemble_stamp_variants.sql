-- Add the French Pokémon Ensemble stamped printings for 151.
-- Existing Standard, Reverse, and Reverse Cosmos rows are left untouched.
insert into public.card_print_variants (
  card_id,
  variant_key,
  variant_label,
  finish_code,
  guide_marker,
  checklist_group,
  is_master_set_target,
  image_url,
  image_source_url
)
select
  c.id,
  'stamp_normal_pokemon_ensemble',
  'Tampon (Pokémon Ensemble)',
  'normal',
  'pokemon-ensemble',
  'stamp',
  true,
  case c.collector_number
    when '025' then 'https://i.ebayimg.com/images/g/ApwAAeSw5ctqdaH3/s-l1600.webp'
    when '133' then 'https://i.ebayimg.com/images/g/opwAAeSw2OhqYgn8/s-l1600.webp'
  end,
  case c.collector_number
    when '025' then 'https://www.ebay.fr/itm/336731255098'
    when '133' then 'https://www.ebay.fr/itm/236957971914'
  end
from public.cards c
join public.card_sets s on s.id = c.card_set_id
where s.set_code = 'sv03.5'
  and s.language = 'FR'
  and c.collector_number in ('025', '133')
on conflict (card_id, variant_key) do nothing;
