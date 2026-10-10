-- Stamped print variants for the French Étincelles Déferlantes (SV08) checklist.
-- The 17 Play! Pokémon Prize Pack Series 7 prints are sourced from the official
-- Series 7 checklist. Other entries are same-number stamped/promotional prints
-- listed for Surging Sparks. Oversized Jumbo prints are excluded from this card checklist.
-- Sources:
-- https://www.pokemon.com/static-assets/content-assets/cms2-fr-fr/pdf/trading-card-game/checklist/prize_pack_series_7_web_cardlist_fr.pdf
-- https://bulbapedia.bulbagarden.net/wiki/SSP

do $$
declare
  target_set_id uuid;
  missing_numbers text[];
begin
  select id into target_set_id
  from public.card_sets
  where lower(set_code) = 'sv08' and language = 'FR'
  limit 1;

  if target_set_id is null then
    raise exception 'French SV08 / Étincelles Déferlantes card set was not found';
  end if;

  select array_agg(candidate.collector_number order by candidate.collector_number)
  into missing_numbers
  from (
    select distinct stamps.collector_number
    from (values
      ('019'), ('029'), ('036'), ('047'), ('050'), ('057'), ('059'),
      ('065'), ('074'), ('076'), ('086'), ('107'), ('129'), ('130'), ('143'),
      ('161'), ('164'), ('169'), ('177'), ('186'), ('187'), ('189')
    ) as stamps(collector_number)
  ) candidate
  left join public.cards c
    on c.card_set_id = target_set_id
   and c.collector_number = candidate.collector_number
  where c.id is null;

  if missing_numbers is not null then
    raise exception 'SV08 stamped variants refer to missing French cards: %', missing_numbers;
  end if;

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
    stamp.variant_key,
    stamp.variant_label,
    stamp.finish_code,
    stamp.guide_marker,
    'stamp',
    stamp.is_master_set_target
  from public.cards c
  join (values
    -- Play! Pokémon Prize Pack Series 7 (17 SV08 cards).
    ('019', 'stamp_play_prize_pack_series_7', 'Tampon Play! Pokémon · Pack Récompense série 7', 'normal', 'player-rewards-program', true),
    ('036', 'stamp_play_prize_pack_series_7', 'Tampon Play! Pokémon · Pack Récompense série 7', 'holo', 'player-rewards-program', true),
    ('057', 'stamp_play_prize_pack_series_7', 'Tampon Play! Pokémon · Pack Récompense série 7', 'holo', 'player-rewards-program', true),
    ('059', 'stamp_play_prize_pack_series_7', 'Tampon Play! Pokémon · Pack Récompense série 7', 'normal', 'player-rewards-program', true),
    ('065', 'stamp_play_prize_pack_series_7', 'Tampon Play! Pokémon · Pack Récompense série 7', 'normal', 'player-rewards-program', true),
    ('074', 'stamp_play_prize_pack_series_7', 'Tampon Play! Pokémon · Pack Récompense série 7', 'normal', 'player-rewards-program', true),
    ('076', 'stamp_play_prize_pack_series_7', 'Tampon Play! Pokémon · Pack Récompense série 7', 'holo', 'player-rewards-program', true),
    ('086', 'stamp_play_prize_pack_series_7', 'Tampon Play! Pokémon · Pack Récompense série 7', 'holo', 'player-rewards-program', true),
    ('107', 'stamp_play_prize_pack_series_7', 'Tampon Play! Pokémon · Pack Récompense série 7', 'normal', 'player-rewards-program', true),
    ('130', 'stamp_play_prize_pack_series_7', 'Tampon Play! Pokémon · Pack Récompense série 7', 'holo', 'player-rewards-program', true),
    ('143', 'stamp_play_prize_pack_series_7', 'Tampon Play! Pokémon · Pack Récompense série 7', 'reverse', 'player-rewards-program', true),
    ('161', 'stamp_play_prize_pack_series_7', 'Tampon Play! Pokémon · Pack Récompense série 7', 'normal', 'player-rewards-program', true),
    ('164', 'stamp_play_prize_pack_series_7', 'Tampon Play! Pokémon · Pack Récompense série 7', 'holo', 'player-rewards-program', true),
    ('169', 'stamp_play_prize_pack_series_7', 'Tampon Play! Pokémon · Pack Récompense série 7', 'normal', 'player-rewards-program', true),
    ('177', 'stamp_play_prize_pack_series_7', 'Tampon Play! Pokémon · Pack Récompense série 7', 'holo', 'player-rewards-program', true),
    ('186', 'stamp_play_prize_pack_series_7', 'Tampon Play! Pokémon · Pack Récompense série 7', 'holo', 'player-rewards-program', true),
    ('189', 'stamp_play_prize_pack_series_7', 'Tampon Play! Pokémon · Pack Récompense série 7', 'holo', 'player-rewards-program', true),

    -- Other numbered Surging Sparks stamped prints and stamped promotional versions.
    ('029', 'stamp_pokemon_horizons', 'Logo Pokémon Horizons', 'normal', 'pokemon-horizons', true),
    ('047', 'stamp_snowflake', 'Tampon flocon · Holo Cosmos', 'holo_cosmos', 'snowflake', true),
    ('050', 'stamp_pokemon_horizons', 'Logo Pokémon Horizons', 'normal', 'pokemon-horizons', true),
    ('059', 'stamp_gym_challenge', 'Tampon Gym Challenge · Normale', 'normal', 'gym-challenge', true),
    ('076', 'stamp_gym_challenge', 'Tampon Gym Challenge · Holo', 'holo', 'gym-challenge', true),
    ('129', 'stamp_set_logo', 'Tampon logo Étincelles Déferlantes', 'normal', 'set-logo', true),
    ('143', 'stamp_gym_challenge', 'Tampon Gym Challenge · Normale', 'normal', 'gym-challenge', true),
    ('161', 'stamp_pokemon_horizons', 'Logo Pokémon Horizons', 'normal', 'pokemon-horizons', true),
    ('169', 'stamp_gym_challenge', 'Tampon Gym Challenge · Normale', 'normal', 'gym-challenge', true),
    ('177', 'stamp_gym_challenge', 'Tampon Gym Challenge · Normale', 'normal', 'gym-challenge', true),
    ('187', 'stamp_regional_championships_2024', 'Tampon Championnat régional 2024 · Reverse', 'reverse', 'regional-championships', true),
    ('187', 'stamp_regional_championships_2024_staff', 'Tampon Championnat régional 2024 + Staff · Reverse', 'reverse', 'regional-championships+staff', true),
    ('189', 'stamp_great_ball_league', 'Tampon Great Ball League · Normale', 'normal', 'great-ball-league', true),
    ('189', 'stamp_gym_challenge', 'Tampon Gym Challenge · Normale', 'normal', 'gym-challenge', true)
  ) as stamp(collector_number, variant_key, variant_label, finish_code, guide_marker, is_master_set_target)
  on c.card_set_id = target_set_id
 and c.collector_number = stamp.collector_number
  on conflict (card_id, variant_key) do update set
    variant_label = excluded.variant_label,
    finish_code = excluded.finish_code,
    guide_marker = excluded.guide_marker,
    checklist_group = excluded.checklist_group,
    is_master_set_target = excluded.is_master_set_target;
end;
$$;
