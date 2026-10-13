-- Keep the original set release date intact while indexing a print by the
-- copyright year shown on the card. Store artwork on the print variant where
-- the stamped version differs from the parent card image.
alter table public.card_print_variants
  add column if not exists copyright_year integer,
  add column if not exists image_url text,
  add column if not exists image_source_url text;

comment on column public.card_print_variants.copyright_year is
  'Copyright year printed on this specific card printing; distinct from its set release date.';
comment on column public.card_print_variants.image_url is
  'Artwork URL for this specific printing when it differs from the parent card artwork.';
comment on column public.card_print_variants.image_source_url is
  'Source page for the artwork of this specific printing.';

-- The Prize Pack Series 6 stamp was printed in 2024 and distributed in 2025.
update public.card_print_variants v
set copyright_year = 2024
from public.cards c
join public.card_sets s on s.id = c.card_set_id
where v.card_id = c.id
  and s.set_code = 'sve'
  and c.collector_number between '009' and '016'
  and v.variant_key = 'stamp_play_pokemon_prize_pack_6';

update public.card_print_variants v
set variant_label = 'Tampon Play! Pokémon · Holo cosmos · ©2024'
from public.cards c
join public.card_sets s on s.id = c.card_set_id
where v.card_id = c.id
  and s.set_code = 'sve'
  and c.collector_number between '009' and '016'
  and v.variant_key = 'stamp_play_pokemon_prize_pack_6';

-- French SVE 011 non-holo Play! stamp, ©2024 (Prize Pack Series 6).
insert into public.card_print_variants (
  card_id, variant_key, variant_label, finish_code, guide_marker,
  checklist_group, is_master_set_target, copyright_year, image_url, image_source_url
)
select c.id,
       'stamp_play_pokemon_prize_pack_6_non_holo',
       'Tampon Play! Pokémon · Non holo · Série 6 · ©2024',
       'standard',
       'play-pokemon-prize-pack-series-6',
       'stamp',
       true,
       2024,
       'https://i.ebayimg.com/images/g/gn0AAeSwxylo~kuO/s-l1600.webp',
       'https://www.ebay.fr/itm/389147195205'
from public.cards c
join public.card_sets s on s.id = c.card_set_id
where s.set_code = 'sve'
  and s.language = 'FR'
  and c.collector_number = '011'
on conflict (card_id, variant_key) do update
set variant_label = excluded.variant_label,
    finish_code = excluded.finish_code,
    guide_marker = excluded.guide_marker,
    checklist_group = excluded.checklist_group,
    is_master_set_target = excluded.is_master_set_target,
    copyright_year = excluded.copyright_year,
    image_url = excluded.image_url,
    image_source_url = excluded.image_source_url;

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
      and v.copyright_year = 2024
      and v.finish_code = 'standard'
  ) then
    raise exception 'Expected the 2024 non-holo SVE 011 Play! print';
  end if;
end;
$$;
