-- Attach French Play! Prize Pack scans to the 2024 SVE prints and index the
-- existing EV10.5 energies by the 2025 copyright printed on the user's card.
-- Image URLs point to the corresponding Poképédia file pages; SVE 017 uses
-- the photo supplied by the user.

update public.card_print_variants v
set image_url = coalesce(v.image_url, x.image_url),
    image_source_url = coalesce(v.image_source_url, x.source_url)
from public.cards c
join public.card_sets s on s.id = c.card_set_id
join (values
  ('009', 'https://www.pokepedia.fr/images/thumb/6/68/Carte_%C3%89carlate_et_Violet_%C3%89nergie_de_base_009_%28Pack_R%C3%A9compense_Play%21_Pok%C3%A9mon%29.png/490px-Carte_%C3%89carlate_et_Violet_%C3%89nergie_de_base_009_%28Pack_R%C3%A9compense_Play%21_Pok%C3%A9mon%29.png', 'https://www.pokepedia.fr/Fichier:Carte_%C3%89carlate_et_Violet_%C3%89nergie_de_base_009_%28Pack_R%C3%A9compense_Play!_Pok%C3%A9mon%29.png'),
  ('010', 'https://www.pokepedia.fr/images/thumb/2/2c/Carte_%C3%89carlate_et_Violet_%C3%89nergie_de_base_010_%28Pack_R%C3%A9compense_Play%21_Pok%C3%A9mon%29.png/490px-Carte_%C3%89carlate_et_Violet_%C3%89nergie_de_base_010_%28Pack_R%C3%A9compense_Play%21_Pok%C3%A9mon%29.png', 'https://www.pokepedia.fr/Fichier:Carte_%C3%89carlate_et_Violet_%C3%89nergie_de_base_010_%28Pack_R%C3%A9compense_Play!_Pok%C3%A9mon%29.png'),
  ('011', 'https://www.pokepedia.fr/images/thumb/e/ed/Carte_%C3%89carlate_et_Violet_%C3%89nergie_de_base_011_%28Pack_R%C3%A9compense_Play%21_Pok%C3%A9mon%29.png/490px-Carte_%C3%89carlate_et_Violet_%C3%89nergie_de_base_011_%28Pack_R%C3%A9compense_Play%21_Pok%C3%A9mon%29.png', 'https://www.pokepedia.fr/Fichier:Carte_%C3%89carlate_et_Violet_%C3%89nergie_de_base_011_%28Pack_R%C3%A9compense_Play!_Pok%C3%A9mon%29.png'),
  ('012', 'https://www.pokepedia.fr/images/thumb/c/c0/Carte_%C3%89carlate_et_Violet_%C3%89nergie_de_base_012_%28Pack_R%C3%A9compense_Play%21_Pok%C3%A9mon%29.png/490px-Carte_%C3%89carlate_et_Violet_%C3%89nergie_de_base_012_%28Pack_R%C3%A9compense_Play%21_Pok%C3%A9mon%29.png', 'https://www.pokepedia.fr/Fichier:Carte_%C3%89carlate_et_Violet_%C3%89nergie_de_base_012_%28Pack_R%C3%A9compense_Play!_Pok%C3%A9mon%29.png'),
  ('013', 'https://www.pokepedia.fr/images/thumb/b/b4/Carte_%C3%89carlate_et_Violet_%C3%89nergie_de_base_013_%28Pack_R%C3%A9compense_Play%21_Pok%C3%A9mon%29.png/490px-Carte_%C3%89carlate_et_Violet_%C3%89nergie_de_base_013_%28Pack_R%C3%A9compense_Play%21_Pok%C3%A9mon%29.png', 'https://www.pokepedia.fr/Fichier:Carte_%C3%89carlate_et_Violet_%C3%89nergie_de_base_013_%28Pack_R%C3%A9compense_Play!_Pok%C3%A9mon%29.png'),
  ('014', 'https://www.pokepedia.fr/images/thumb/b/b0/Carte_%C3%89carlate_et_Violet_%C3%89nergie_de_base_014_%28Pack_R%C3%A9compense_Play%21_Pok%C3%A9mon%29.png/490px-Carte_%C3%89carlate_et_Violet_%C3%89nergie_de_base_014_%28Pack_R%C3%A9compense_Play%21_Pok%C3%A9mon%29.png', 'https://www.pokepedia.fr/Fichier:Carte_%C3%89carlate_et_Violet_%C3%89nergie_de_base_014_%28Pack_R%C3%A9compense_Play!_Pok%C3%A9mon%29.png'),
  ('015', 'https://www.pokepedia.fr/images/thumb/b/b4/Carte_%C3%89carlate_et_Violet_%C3%89nergie_de_base_015_%28Pack_R%C3%A9compense_Play%21_Pok%C3%A9mon%29.png/490px-Carte_%C3%89carlate_et_Violet_%C3%89nergie_de_base_015_%28Pack_R%C3%A9compense_Play%21_Pok%C3%A9mon%29.png', 'https://www.pokepedia.fr/Fichier:Carte_%C3%89carlate_et_Violet_%C3%89nergie_de_base_015_%28Pack_R%C3%A9compense_Play!_Pok%C3%A9mon%29.png'),
  ('016', 'https://www.pokepedia.fr/images/thumb/8/83/Carte_%C3%89carlate_et_Violet_%C3%89nergie_de_base_016_%28Pack_R%C3%A9compense_Play%21_Pok%C3%A9mon%29.png/490px-Carte_%C3%89carlate_et_Violet_%C3%89nergie_de_base_016_%28Pack_R%C3%A9compense_Play%21_Pok%C3%A9mon%29.png', 'https://www.pokepedia.fr/Fichier:Carte_%C3%89carlate_et_Violet_%C3%89nergie_de_base_016_%28Pack_R%C3%A9compense_Play!_Pok%C3%A9mon%29.png')
) as x(collector_number, image_url, source_url) on x.collector_number = c.collector_number
where v.card_id = c.id
  and s.set_code = 'sve'
  and s.language = 'FR'
  and v.variant_key = 'stamp_play_pokemon_prize_pack_6'
  and v.image_url is null;

-- The supplied SVE FR 017 photo is a 2025 EV10.5 printing. Preserve the
-- existing card scan and attach this image only to its specific print variant.
update public.card_print_variants v
set copyright_year = coalesce(v.copyright_year, 2025),
    variant_label = 'Holo striée · EV10.5 · ©2025',
    image_url = coalesce(v.image_url, '/catalog/sve-fr-017-ev10-5.jpg')
from public.cards c
join public.card_sets s on s.id = c.card_set_id
where v.card_id = c.id
  and s.set_code = 'sv10.5e'
  and s.language = 'FR'
  and c.collector_number between '017' and '024'
  and v.variant_key = 'holo_striee_ev10_5';

do $$
declare
  stamped_count integer;
  ev10_5_count integer;
begin
  select count(*)::integer into stamped_count
  from public.card_print_variants v
  join public.cards c on c.id = v.card_id
  join public.card_sets s on s.id = c.card_set_id
  where s.set_code = 'sve'
    and s.language = 'FR'
    and c.collector_number between '009' and '016'
    and v.variant_key = 'stamp_play_pokemon_prize_pack_6'
    and v.image_url like 'https://www.pokepedia.fr/images/thumb/%';

  if stamped_count <> 8 then
    raise exception 'Expected eight French Play! stamp scans, found %', stamped_count;
  end if;

  select count(*)::integer into ev10_5_count
  from public.card_print_variants v
  join public.cards c on c.id = v.card_id
  join public.card_sets s on s.id = c.card_set_id
  where s.set_code = 'sv10.5e'
    and s.language = 'FR'
    and c.collector_number between '017' and '024'
    and v.variant_key = 'holo_striee_ev10_5'
    and v.copyright_year = 2025;

  if ev10_5_count <> 8 then
    raise exception 'Expected eight 2025 EV10.5 energy variants, found %', ev10_5_count;
  end if;
end;
$$;
