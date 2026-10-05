-- Link the verified foil promos in the 2015, 2016, and Spring 2018 Collector Chests.
-- Product contents (official Pokémon product galleries):
-- * Autumn 2015: Hoopa, Pikachu, and Chespin.
--   https://www.pokemon.com/us/pokemon-tcg/product-gallery/collector-chest-2015
-- * Autumn 2016: Volcanion, Magearna, and Shiny Mega Gengar-EX.
--   https://www.pokemon.com/uk/pokemon-tcg/product-gallery/autumn-2016-collector-chest
-- * Spring 2018: Dusk Form Lycanroc, Dusk Mane Necrozma, and Dawn Wings Necrozma.
--   https://www.pokemon.com/uk/pokemon-tcg/product-gallery/collector-chest-spring-2018
-- The promo numbers were cross-checked against the XY/SM promo checklists and their
-- corresponding Pokémon card-catalogue entries.

do $$
declare
  changed_rows integer;
begin
  update public.product_contents
  set card_id = '4f9796ab-b7f1-4ed2-a749-7e3ecac35c6c'
  where id = 'b5107cdb-7c3c-4096-b2a8-65bf1fe632c9'
    and card_id is null
    and item_name = 'Marisson'
    and content_type = 'promo'
    and confidence = 'verified';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Marisson content row for Autumn 2015 Collector Chest, updated %', changed_rows;
  end if;

  update public.product_contents
  set card_id = 'd2f73e1c-13ea-4420-b6f8-32af4b2c8aab'
  where id = 'c62f52bc-583e-4b6d-8928-5794499da8ac'
    and card_id is null
    and item_name = 'Pikachu'
    and content_type = 'promo'
    and confidence = 'verified';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Pikachu content row for Autumn 2015 Collector Chest, updated %', changed_rows;
  end if;

  update public.product_contents
  set card_id = '4f30f036-6678-46bc-b8e1-35a395f55ebb'
  where id = 'f3691595-7d03-44c4-8dde-5432bbedc558'
    and card_id is null
    and item_name = 'Hoopa'
    and content_type = 'promo'
    and confidence = 'verified';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Hoopa content row for Autumn 2015 Collector Chest, updated %', changed_rows;
  end if;

  update public.product_contents
  set card_id = '01c536d2-5082-4246-8b7b-45353f88b4c3'
  where id = 'e7a319eb-0055-45ab-9458-df1deb06adc9'
    and card_id is null
    and item_name = 'Volcanion'
    and content_type = 'promo'
    and confidence = 'verified';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Volcanion content row for Autumn 2016 Collector Chest, updated %', changed_rows;
  end if;

  update public.product_contents
  set card_id = 'a5ed793c-677a-4d7e-8ddd-5e931b5ca67f'
  where id = '75f8c41a-f444-4386-ae28-92e4cbb5cb4d'
    and card_id is null
    and item_name = 'Magearna'
    and content_type = 'promo'
    and confidence = 'verified';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Magearna content row for Autumn 2016 Collector Chest, updated %', changed_rows;
  end if;

  update public.product_contents
  set card_id = 'a0f6b0e6-86da-4979-b6fa-f96835ff4db5'
  where id = 'cb50afd1-4790-41a4-aeba-ee07a30518cd'
    and card_id is null
    and item_name = 'Méga-Ectoplasma-EX chromatique'
    and content_type = 'promo'
    and confidence = 'verified';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Mega Gengar-EX content row for Autumn 2016 Collector Chest, updated %', changed_rows;
  end if;

  update public.product_contents
  set card_id = 'cf392603-6402-47b5-b2e6-dd92d3ae3f8a'
  where id = '8cdd7207-efcb-44dc-983a-54c106b0e211'
    and card_id is null
    and item_name = 'Lougaroc Forme Crépusculaire'
    and content_type = 'promo'
    and confidence = 'verified';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Dusk Form Lycanroc content row for Spring 2018 Collector Chest, updated %', changed_rows;
  end if;

  update public.product_contents
  set card_id = 'a0ad3035-4284-46c5-85d3-9928596197c7'
  where id = '274cdb06-101f-4dab-8e67-c163b84f1e24'
    and card_id is null
    and item_name = 'Necrozma Ailes de l’Aurore'
    and content_type = 'promo'
    and confidence = 'verified';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Dawn Wings Necrozma content row for Spring 2018 Collector Chest, updated %', changed_rows;
  end if;

  update public.product_contents
  set card_id = 'dd82de4f-c1dd-40de-b6d2-4c8b05761d75'
  where id = '6ebb13bf-b234-43e5-8859-cdde6b2ddf97'
    and card_id is null
    and item_name = 'Necrozma Crinière du Couchant'
    and content_type = 'promo'
    and confidence = 'verified';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Dusk Mane Necrozma content row for Spring 2018 Collector Chest, updated %', changed_rows;
  end if;
end
$$;
