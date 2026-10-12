-- EV8.5 card 074 is the Pokémon Day 2025 stamped print, not a core reverse-cosmos variant.
-- Keep the existing variant id so collection copies and their metadata remain attached.
update public.card_print_variants v
set variant_key = 'stamp_pokemon_day_2025',
    variant_label = 'Tampon Pokémon Day 2025',
    finish_code = 'holo_cosmos',
    guide_marker = 'pokemon-day-2025',
    checklist_group = 'stamp',
    is_master_set_target = false
from public.cards c
join public.card_sets s on s.id = c.card_set_id
where v.card_id = c.id
  and lower(s.set_code) = 'sv08.5'
  and c.collector_number = '074'
  and v.variant_key = 'reverse_cosmos';
