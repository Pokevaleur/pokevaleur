-- Exclude digital Pokémon TCG Pocket sets from PokéValeur's physical-card catalog.
-- The records were private, had no print variants, and were not linked to personal collections.
-- Keep this cleanup after the historical catalog import so fresh database resets remain physical-only.
delete from public.cards c
using public.card_sets s
where c.card_set_id = s.id
  and s.language = 'FR'
  and s.series_name = 'Jeu de Cartes à Collectionner Pokémon Pocket'
  and s.set_code = any(array[
    'P-A','A1','A1a','A2','A2a','A2b','A3','A3a','A3b','A4','A4a',
    'B1','B1a','B2','B2a'
  ]::text[]);

delete from public.card_sets s
where s.language = 'FR'
  and s.series_name = 'Jeu de Cartes à Collectionner Pokémon Pocket'
  and s.set_code = any(array[
    'P-A','A1','A1a','A2','A2a','A2b','A3','A3a','A3b','A4','A4a',
    'B1','B1a','B2','B2a'
  ]::text[])
  and not exists (
    select 1
    from public.cards c
    where c.card_set_id = s.id
  );
