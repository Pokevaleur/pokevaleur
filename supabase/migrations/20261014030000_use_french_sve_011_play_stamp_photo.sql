-- Use the exact French SVE FR 011 stamp photo supplied for this catalog entry.
update public.card_print_variants v
set image_url = '/catalog/sve-fr-011-play-stamp.jpg',
    image_source_url = null
from public.cards c
join public.card_sets s on s.id = c.card_set_id
where v.card_id = c.id
  and s.set_code = 'sve'
  and s.language = 'FR'
  and c.collector_number = '011'
  and v.variant_key = 'stamp_play_pokemon_prize_pack_6_non_holo';

do $$
begin
  if not exists (
    select 1
    from public.card_print_variants v
    join public.cards c on c.id = v.card_id
    join public.card_sets s on s.id = c.card_set_id
    where s.set_code = 'sve'
      and s.language = 'FR'
      and c.collector_number = '011'
      and v.variant_key = 'stamp_play_pokemon_prize_pack_6_non_holo'
      and v.image_url = '/catalog/sve-fr-011-play-stamp.jpg'
  ) then
    raise exception 'French SVE 011 Play! stamp photo was not linked';
  end if;
end;
$$;
