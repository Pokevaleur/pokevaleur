-- Link seven verified XY-era promo contents to their exact catalog cards.
-- Product contents are corroborated by Pokémon product pages and contemporary product reporting;
-- collector numbers are cross-checked against the XY promo checklist.
-- https://www.pokemon.com/us/pokemon-tcg/product-gallery/mega-mewtwo-collection
-- https://www.pokebeach.com/2015/11/mega-mewtwo-collections-now-in-stores-xy100101-mewtwo-promos
-- https://pokegraph.com/508-mise-a-jour-tcg-recapitulatif-des-sorties-2016
-- https://www.pokemon.com/us/pokemon-tcg/product-gallery/mega-absol-ex-collection
-- https://www.pokebeach.com/2015/05/mega-absol-ex-premium-collection
-- https://www.pokemon.com/uk/pokemon-tcg/product-gallery/mega-aerodactyl-ex-premium-collection/
-- https://www.pokebeach.com/2015/12/aerodactyl-and-aurorus-boxes-in-some-stores-early
-- https://www.pokebeach.com/2014/11/metagross-ex-m-metagross-ex-in-mega-metagross-ex-premium-collection

do $$
declare
  changed_rows integer;
begin
  update public.product_contents pc
  set card_id = mapping.card_id
  from (values
    ('f4c8f06d-3f0c-4938-9b4c-207b2371e629'::uuid, '4e374a5b-a0ba-4c6f-893e-f9b0e208b6a4'::uuid, 'Mewtwo', 'XY100'),
    ('2ba31525-8629-4eed-9240-6f489fdb84f5'::uuid, '9fae22a5-063f-4271-9ba1-55e582d9ef7d'::uuid, 'Mewtwo', 'XY101'),
    ('8ede3b76-3d41-40c9-b458-ea54c7aed3b5'::uuid, 'e89f989c-7cf8-4e9e-9238-ea4700d513d5'::uuid, 'Lucario', 'XY140'),
    ('6499f832-886c-4d4c-b18d-0d7d5092a4f8'::uuid, '075b0fcc-5e73-4450-a6fa-396b58f4abd1'::uuid, 'Méga-Absol-EX', 'XY63'),
    ('ff58fb2a-7363-4446-890f-7a526baa375f'::uuid, '24f91a1a-a016-43bb-bca8-7ad2d566c8ef'::uuid, 'Méga-Ptéra-EX', 'XY98'),
    ('63308bd0-21c1-4be7-9e77-292f0bd7eb4a'::uuid, '5d193fa6-c2bd-4663-a482-b112d4c5b473'::uuid, 'Métalosse-EX chromatique', 'XY34'),
    ('d0745a36-e3cb-46fd-9844-94cfa4b947c6'::uuid, 'f6940d1a-f8ae-4750-91b7-8bb51d632d72'::uuid, 'Méga-Métalosse-EX chromatique', 'XY35')
  ) as mapping(content_id, card_id, item_name, collector_number)
  where pc.id = mapping.content_id
    and pc.card_id is null
    and pc.item_name = mapping.item_name
    and pc.content_type = 'promo'
    and pc.confidence = 'verified'
    and exists (
      select 1
      from public.cards c
      join public.card_sets s on s.id = c.card_set_id
      where c.id = mapping.card_id
        and c.collector_number = mapping.collector_number
        and s.set_code = 'xyp'
    );
  get diagnostics changed_rows = row_count;
  if changed_rows <> 7 then
    raise exception 'Expected seven verified XY promo contents, updated %', changed_rows;
  end if;
end
$$;
