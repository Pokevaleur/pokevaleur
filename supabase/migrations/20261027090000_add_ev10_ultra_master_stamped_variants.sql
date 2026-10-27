-- French EV10 / Rivalités Destinées Ultra Master Set stamped prints.
-- Data transcribed from the v1.06 Ultra Master Set Ligue Staff checklist by @grall_69.
-- Adds only stamped print variants; existing card records and variants are left untouched.
-- The checklist's 465 print total consists of the 421 existing main variants plus these 44 stamp variants.
do $$
declare
  target_set_id uuid;
  missing_numbers text[];
begin
  select id into target_set_id
  from public.card_sets
  where lower(set_code) = 'sv10' and language = 'FR'
  limit 1;

  if target_set_id is null then
    raise exception 'French SV10 / Rivalités Destinées card set was not found';
  end if;

  select array_agg(required.collector_number order by required.collector_number)
  into missing_numbers
  from (
    select distinct stamp.collector_number
    from (values
      ('003'), ('008'), ('010'), ('012'), ('020'), ('031'), ('033'), ('034'),
      ('036'), ('039'), ('049'), ('070'), ('078'), ('081'), ('087'), ('096'),
      ('101'), ('103'), ('104'), ('119'), ('122'), ('136'), ('139'), ('162'),
      ('165'), ('170'), ('171'), ('173'), ('174'), ('176'), ('177'), ('178'),
      ('182'), ('208'), ('229')
    ) as stamp(collector_number)
  ) required
  left join public.cards c
    on c.card_set_id = target_set_id
   and c.collector_number = required.collector_number
  where c.id is null;

  if missing_numbers is not null then
    raise exception 'EV10 stamp variants refer to missing French cards: %', missing_numbers;
  end if;
end;
$$;

insert into public.card_print_variants (
  card_id, variant_key, variant_label, finish_code, guide_marker,
  checklist_group, is_master_set_target
)
select
  c.id,
  stamp.variant_key,
  stamp.variant_label,
  stamp.finish_code,
  stamp.guide_marker,
  'stamp',
  true
from public.cards c
join (
  values
    -- Non-Holo promos with Play! Pokémon stamp (18).
    ('008', 'stamp_play_pokemon_non_holo', 'Promo non-holo + tampon Play! Pokémon', 'normal', 'player-rewards-program'),
    ('010', 'stamp_play_pokemon_non_holo', 'Promo non-holo + tampon Play! Pokémon', 'normal', 'player-rewards-program'),
    ('012', 'stamp_play_pokemon_non_holo', 'Promo non-holo + tampon Play! Pokémon', 'normal', 'player-rewards-program'),
    ('020', 'stamp_play_pokemon_non_holo', 'Promo non-holo + tampon Play! Pokémon', 'normal', 'player-rewards-program'),
    ('033', 'stamp_play_pokemon_non_holo', 'Promo non-holo + tampon Play! Pokémon', 'normal', 'player-rewards-program'),
    ('034', 'stamp_play_pokemon_non_holo', 'Promo non-holo + tampon Play! Pokémon', 'normal', 'player-rewards-program'),
    ('036', 'stamp_play_pokemon_non_holo', 'Promo non-holo + tampon Play! Pokémon', 'normal', 'player-rewards-program'),
    ('078', 'stamp_play_pokemon_non_holo', 'Promo non-holo + tampon Play! Pokémon', 'normal', 'player-rewards-program'),
    ('101', 'stamp_play_pokemon_non_holo', 'Promo non-holo + tampon Play! Pokémon', 'normal', 'player-rewards-program'),
    ('103', 'stamp_play_pokemon_non_holo', 'Promo non-holo + tampon Play! Pokémon', 'normal', 'player-rewards-program'),
    ('162', 'stamp_play_pokemon_non_holo', 'Promo non-holo + tampon Play! Pokémon', 'normal', 'player-rewards-program'),
    ('165', 'stamp_play_pokemon_non_holo', 'Promo non-holo + tampon Play! Pokémon', 'normal', 'player-rewards-program'),
    ('170', 'stamp_play_pokemon_non_holo', 'Promo non-holo + tampon Play! Pokémon', 'normal', 'player-rewards-program'),
    ('171', 'stamp_play_pokemon_non_holo', 'Promo non-holo + tampon Play! Pokémon', 'normal', 'player-rewards-program'),
    ('174', 'stamp_play_pokemon_non_holo', 'Promo non-holo + tampon Play! Pokémon', 'normal', 'player-rewards-program'),
    ('176', 'stamp_play_pokemon_non_holo', 'Promo non-holo + tampon Play! Pokémon', 'normal', 'player-rewards-program'),
    ('177', 'stamp_play_pokemon_non_holo', 'Promo non-holo + tampon Play! Pokémon', 'normal', 'player-rewards-program'),
    ('178', 'stamp_play_pokemon_non_holo', 'Promo non-holo + tampon Play! Pokémon', 'normal', 'player-rewards-program'),

    -- Cosmos Holo / Ultra promos with Play! Pokémon stamp (14).
    ('003', 'stamp_play_pokemon_cosmos_ultra', 'Promo Cosmos Holo / Ultra + tampon Play! Pokémon', 'promo_play', 'player-rewards-program'),
    ('008', 'stamp_play_pokemon_cosmos_ultra', 'Promo Cosmos Holo / Ultra + tampon Play! Pokémon', 'promo_play', 'player-rewards-program'),
    ('020', 'stamp_play_pokemon_cosmos_ultra', 'Promo Cosmos Holo / Ultra + tampon Play! Pokémon', 'promo_play', 'player-rewards-program'),
    ('034', 'stamp_play_pokemon_cosmos_ultra', 'Promo Cosmos Holo / Ultra + tampon Play! Pokémon', 'promo_play', 'player-rewards-program'),
    ('039', 'stamp_play_pokemon_cosmos_ultra', 'Promo Cosmos Holo / Ultra + tampon Play! Pokémon', 'promo_play', 'player-rewards-program'),
    ('078', 'stamp_play_pokemon_cosmos_ultra', 'Promo Cosmos Holo / Ultra + tampon Play! Pokémon', 'promo_play', 'player-rewards-program'),
    ('081', 'stamp_play_pokemon_cosmos_ultra', 'Promo Cosmos Holo / Ultra + tampon Play! Pokémon', 'promo_play', 'player-rewards-program'),
    ('104', 'stamp_play_pokemon_cosmos_ultra', 'Promo Cosmos Holo / Ultra + tampon Play! Pokémon', 'promo_play', 'player-rewards-program'),
    ('119', 'stamp_play_pokemon_cosmos_ultra', 'Promo Cosmos Holo / Ultra + tampon Play! Pokémon', 'promo_play', 'player-rewards-program'),
    ('122', 'stamp_play_pokemon_cosmos_ultra', 'Promo Cosmos Holo / Ultra + tampon Play! Pokémon', 'promo_play', 'player-rewards-program'),
    ('136', 'stamp_play_pokemon_cosmos_ultra', 'Promo Cosmos Holo / Ultra + tampon Play! Pokémon', 'promo_play', 'player-rewards-program'),
    ('139', 'stamp_play_pokemon_cosmos_ultra', 'Promo Cosmos Holo / Ultra + tampon Play! Pokémon', 'promo_play', 'player-rewards-program'),
    ('165', 'stamp_play_pokemon_cosmos_ultra', 'Promo Cosmos Holo / Ultra + tampon Play! Pokémon', 'promo_play', 'player-rewards-program'),
    ('173', 'stamp_play_pokemon_cosmos_ultra', 'Promo Cosmos Holo / Ultra + tampon Play! Pokémon', 'promo_play', 'player-rewards-program'),

    -- Cosmos Holo promos with Rivalités Destinées prerelease stamp (4).
    ('034', 'stamp_prerelease_cosmos', 'Promo Cosmos Holo + tampon Avant-Première Rivalités Destinées', 'holo_cosmos', 'prerelease-rivalites-destinees'),
    ('049', 'stamp_prerelease_cosmos', 'Promo Cosmos Holo + tampon Avant-Première Rivalités Destinées', 'holo_cosmos', 'prerelease-rivalites-destinees'),
    ('087', 'stamp_prerelease_cosmos', 'Promo Cosmos Holo + tampon Avant-Première Rivalités Destinées', 'holo_cosmos', 'prerelease-rivalites-destinees'),
    ('096', 'stamp_prerelease_cosmos', 'Promo Cosmos Holo + tampon Avant-Première Rivalités Destinées', 'holo_cosmos', 'prerelease-rivalites-destinees'),

    -- Cosmos Holo promos with both prerelease and Staff stamps (4).
    ('034', 'stamp_prerelease_staff_cosmos', 'Promo Cosmos Holo + tampons Avant-Première Rivalités Destinées et STAFF', 'holo_cosmos', 'prerelease-rivalites-destinees+staff'),
    ('049', 'stamp_prerelease_staff_cosmos', 'Promo Cosmos Holo + tampons Avant-Première Rivalités Destinées et STAFF', 'holo_cosmos', 'prerelease-rivalites-destinees+staff'),
    ('087', 'stamp_prerelease_staff_cosmos', 'Promo Cosmos Holo + tampons Avant-Première Rivalités Destinées et STAFF', 'holo_cosmos', 'prerelease-rivalites-destinees+staff'),
    ('096', 'stamp_prerelease_staff_cosmos', 'Promo Cosmos Holo + tampons Avant-Première Rivalités Destinées et STAFF', 'holo_cosmos', 'prerelease-rivalites-destinees+staff'),

    -- Cosmos Holo promo with GameStop stamp (1).
    ('070', 'stamp_gamestop_cosmos', 'Promo Cosmos Holo + tampon GameStop', 'holo_cosmos', 'gamestop'),

    -- Holo promos with Rivalités Destinées prerelease stamp (3).
    ('031', 'stamp_prerelease_holo', 'Promo Holo + tampon Avant-Première Rivalités Destinées', 'holo', 'prerelease-rivalites-destinees'),
    ('208', 'stamp_prerelease_holo', 'Promo Holo + tampon Avant-Première Rivalités Destinées', 'holo', 'prerelease-rivalites-destinees'),
    ('229', 'stamp_prerelease_holo', 'Promo Holo + tampon Avant-Première Rivalités Destinées', 'holo', 'prerelease-rivalites-destinees')
) as stamp(collector_number, variant_key, variant_label, finish_code, guide_marker)
  on c.card_set_id = (select id from public.card_sets where lower(set_code) = 'sv10' and language = 'FR' limit 1)
 and c.collector_number = stamp.collector_number
on conflict (card_id, variant_key) do nothing;

update public.card_sets
set checklist_scope_note = concat_ws(
  E'\n',
  nullif(checklist_scope_note, ''),
  'Clarification v1.06 (fiche Ultra Master Set Ligue Staff de @grall_69) : le document recense 465 tirages pour 244 numéros, soit les 421 versions principales déjà au catalogue et 44 versions tamponnées maintenant détaillées dans le groupe « stamp » (18 non-holo Play! Pokémon, 14 Cosmos Holo / Ultra Play! Pokémon, 4 Avant-Première Cosmos Holo, 4 Avant-Première + Staff, 3 Holo Avant-Première, 1 GameStop). Cette clarification remplace la réserve précédente sur les impressions tamponnées en attente de validation française.'
)
where lower(set_code) = 'sv10'
  and language = 'FR'
  and checklist_scope_note not like '%Clarification v1.06 (fiche Ultra Master Set Ligue Staff de @grall_69)%';
