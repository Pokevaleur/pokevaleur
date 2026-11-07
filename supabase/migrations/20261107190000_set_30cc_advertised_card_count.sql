-- The French Classic Collection anniversary subset is numbered 001–030.
-- The catalogue already contains all 30 cards, but its advertised count was left at 0.
update public.card_sets
set advertised_card_count = 30
where set_code = '30CC'
  and language = 'FR'
  and advertised_card_count is distinct from 30;
