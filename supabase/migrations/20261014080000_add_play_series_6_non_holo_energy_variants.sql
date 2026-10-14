-- Add the non-holo Play! Pokémon Prize Pack Series 6 printing for every
-- French SVE energy 009–016. The existing 011 row is preserved by DO NOTHING.
insert into public.card_print_variants (
  card_id,
  variant_key,
  variant_label,
  finish_code,
  guide_marker,
  checklist_group,
  is_master_set_target,
  copyright_year
)
select
  c.id,
  'stamp_play_pokemon_prize_pack_6_non_holo',
  'Tampon Play! Pokémon · Non holo · Série 6 · ©2024',
  'standard',
  'play-pokemon-prize-pack-series-6',
  'stamp',
  true,
  2024
from public.cards c
join public.card_sets s on s.id = c.card_set_id
where s.set_code = 'sve'
  and s.language = 'FR'
  and c.card_type = 'Énergie'
  and c.collector_number between '009' and '016'
on conflict (card_id, variant_key) do nothing;

do $$
declare
  holo_count integer;
  non_holo_count integer;
begin
  select count(*)::integer into holo_count
  from public.card_print_variants v
  join public.cards c on c.id = v.card_id
  join public.card_sets s on s.id = c.card_set_id
  where s.set_code = 'sve'
    and s.language = 'FR'
    and c.card_type = 'Énergie'
    and c.collector_number between '009' and '016'
    and v.variant_key = 'stamp_play_pokemon_prize_pack_6'
    and v.finish_code = 'holo'
    and v.copyright_year = 2024;

  select count(*)::integer into non_holo_count
  from public.card_print_variants v
  join public.cards c on c.id = v.card_id
  join public.card_sets s on s.id = c.card_set_id
  where s.set_code = 'sve'
    and s.language = 'FR'
    and c.card_type = 'Énergie'
    and c.collector_number between '009' and '016'
    and v.variant_key = 'stamp_play_pokemon_prize_pack_6_non_holo'
    and v.finish_code = 'standard'
    and v.copyright_year = 2024;

  if holo_count <> 8 then
    raise exception 'Expected eight 2024 Play! holo-cosmos energies, found %', holo_count;
  end if;
  if non_holo_count <> 8 then
    raise exception 'Expected eight 2024 Play! non-holo energies, found %', non_holo_count;
  end if;
end;
$$;
