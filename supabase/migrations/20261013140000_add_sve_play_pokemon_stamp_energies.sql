-- Add the Play! Pokémon Prize Pack Series 6 cosmos-holo stamps for SVE basic energies.
-- These eight stamped printings keep their parent SVE card identity and can be tracked in collections.
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
  c.id,
  'stamp_play_pokemon_prize_pack_6',
  'Tampon Play! Pokémon · Holo cosmos',
  'holo',
  'play-pokemon-prize-pack-series-6',
  'stamp',
  true
from public.cards c
join public.card_sets s on s.id = c.card_set_id
where s.set_code = 'sve'
  and c.card_type = 'Énergie'
  and c.collector_number between '009' and '016'
on conflict (card_id, variant_key) do update
set variant_label = excluded.variant_label,
    finish_code = excluded.finish_code,
    guide_marker = excluded.guide_marker,
    checklist_group = excluded.checklist_group,
    is_master_set_target = excluded.is_master_set_target;
