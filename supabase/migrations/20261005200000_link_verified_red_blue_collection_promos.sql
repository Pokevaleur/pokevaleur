-- Link the four verified Red & Blue Collection foil promos to XY121–XY124.
-- Pokémon's product pages identify each named promo; the XY promo checklist confirms
-- the corresponding promo numbers for the Charizard, Blastoise, Venusaur and Pikachu boxes.
-- https://www.pokemon.com/uk/pokemon-tcg/product-gallery/red-blue-collection-charizard-ex
-- https://www.pokemon.com/uk/pokemon-tcg/product-gallery/red-blue-collection-blastoise-ex
-- https://www.pokemon.com/uk/pokemon-tcg/product-gallery/red-blue-collection-venusaur-ex
-- https://www.pokemon.com/uk/pokemon-tcg/product-gallery/red-blue-collection-pikachu-ex
-- https://bulbapedia.bulbagarden.net/wiki/XYP#Card_list

do $$
declare
  changed_rows integer;
begin
  update public.product_contents pc
  set card_id = mapping.card_id
  from (values
    ('82a3ded4-ea7a-4afc-9cfc-6b90f2c12cc2'::uuid, '65534b44-7576-417f-9737-d1385b78e5ab'::uuid, 'Dracaufeu-EX', 'XY121'),
    ('56bc4a0b-d72b-44ee-b176-a70cabfe4554'::uuid, 'fe09ddba-4b97-4ed9-b159-6f9241c31c55'::uuid, 'Tortank-EX', 'XY122'),
    ('9ab91148-69bb-4514-92e8-42ba9246bc01'::uuid, '0ba17f1d-f1f6-472e-8dd5-6a3b1aec05f1'::uuid, 'Florizarre-EX', 'XY123'),
    ('29719d4a-1b50-4399-b2bf-47cb957ea5b9'::uuid, 'd579fcdf-1058-4986-a43f-8dcb1112419b'::uuid, 'Pikachu-EX', 'XY124')
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
  if changed_rows <> 4 then
    raise exception 'Expected four verified Red & Blue Collection promo contents, updated %', changed_rows;
  end if;
end
$$;
