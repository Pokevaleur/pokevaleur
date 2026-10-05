-- Link the eleven individual Mythical Pokémon Collection promos to their exact XY promo cards.
-- The Pokémon product pages document the included foil promo cards; the XY promo checklist
-- maps each collection to its corresponding collector number (XY110–XY120).
-- https://www.pokemon.com/uk/pokemon-tcg/product-gallery/mythical-pokemon-collection-mew
-- https://www.pokemon.com/uk/pokemon-tcg/product-gallery/mythical-pokemon-collection-celebi
-- https://www.pokemon.com/uk/pokemon-tcg/product-gallery/mythical-pokemon-collection-jirachi
-- https://www.pokemon.com/uk/pokemon-tcg/product-gallery/mythical-pokemon-collection-manaphy
-- https://www.pokemon.com/uk/pokemon-tcg/product-gallery/mythical-pokemon-collection-darkrai
-- https://www.pokemon.com/uk/pokemon-tcg/product-gallery/mythical-pokemon-collection-shaymin
-- https://www.pokemon.com/us/pokemon-tcg/product-gallery/mythical-pokemon-collection-arceus
-- https://www.pokemon.com/uk/pokemon-tcg/product-gallery/mythical-pokemon-collection-victini
-- https://www.pokemon.com/uk/pokemon-tcg/product-gallery/mythical-pokemon-collection-keldeo
-- https://www.pokemon.com/uk/pokemon-tcg/product-gallery/mythical-pokemon-collection-genesect
-- https://www.pokemon.com/uk/pokemon-tcg/product-gallery/mythical-pokemon-collection-meloetta
-- https://bulbapedia.bulbagarden.net/wiki/XYP#Card_list

do $$
declare
  changed_rows integer;
begin
  update public.product_contents pc
  set card_id = mapping.card_id
  from (values
    ('6107aa29-3f20-42ab-be7c-9b02860358bb'::uuid, '34d86bb7-9465-4d1a-aadc-53cbc81fa036'::uuid, 'Mew', 'XY110'),
    ('92d30230-db49-44cb-9ae8-59ca95f38ca7'::uuid, '7476ccc1-8be9-4268-aec2-ac5ff96812dc'::uuid, 'Celebi', 'XY111'),
    ('2cd868e5-d9f4-4939-988e-377a65cb917a'::uuid, '4af52285-665d-4008-82f3-b4a924b485a9'::uuid, 'Jirachi', 'XY112'),
    ('fbd60526-fccf-4fb5-9a0d-18e468c420ac'::uuid, '0af607e1-960a-4a27-8e91-d84c998c7907'::uuid, 'Manaphy', 'XY113'),
    ('0a6672e8-2196-4e47-9752-5989a12a93ac'::uuid, '7b64d38b-6791-4f05-a369-e16fecfc1a8d'::uuid, 'Darkrai', 'XY114'),
    ('0ff8b204-c207-4a43-bd9d-ffcca0216c54'::uuid, '3afdd2c7-8df5-472a-9e23-5a7a2885cbe6'::uuid, 'Shaymin', 'XY115'),
    ('eb059c59-43c1-4be0-9384-d180071058e6'::uuid, '650862fa-d677-4b9c-8014-a21c91acaa17'::uuid, 'Arceus', 'XY116'),
    ('4cad1ad1-3fff-43e2-8ea6-fd6f626aacb2'::uuid, '5c0186d5-e3a2-41d8-b42b-6ce33b6927d2'::uuid, 'Victini', 'XY117'),
    ('281adb44-3df2-410b-a486-c994f9d624ca'::uuid, '1874afe0-ac99-439b-8deb-f296754b579b'::uuid, 'Keldeo', 'XY118'),
    ('3048532c-edba-49cb-af1e-2464dfbe0ed5'::uuid, '0d90c9c3-9feb-43ba-b973-802da216ddfa'::uuid, 'Genesect', 'XY119'),
    ('8e40cb44-3747-4964-b396-a5ad5eee172a'::uuid, '77e48715-991d-4600-b31a-b50c3c393103'::uuid, 'Meloetta', 'XY120')
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
  if changed_rows <> 11 then
    raise exception 'Expected eleven verified Mythical Pokémon Collection promos, updated %', changed_rows;
  end if;
end
$$;
