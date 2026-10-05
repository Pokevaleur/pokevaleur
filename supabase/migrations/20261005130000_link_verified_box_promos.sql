-- Link eight verified promo-card contents to their sealed Pokémon products.
-- The official product galleries confirm the promo Pokémon in each product. The
-- printed promo numbers are cross-checked against the XY/SM/SWSH promo checklists.
-- Ash-Greninja-EX Box: https://www.pokemon.com/uk/pokemon-tcg/product-gallery/ash-greninja-ex-box
-- Dragonite V Box: https://www.pokemon.com/us/pokemon-tcg/product-gallery/dragonite-v-box/
-- Shiny Rayquaza-EX Box: https://www.pokemon.com/uk/pokemon-tcg/product-gallery/shiny-rayquaza-ex-box
-- Shiny Silvally-GX Box: https://www.pokemon.com/uk/pokemon-tcg/product-gallery/shiny-silvally-gx-box
-- Shiny Tapu Koko-GX Box: https://www.pokemon.com/uk/pokemon-tcg/product-gallery/shiny-tapu-koko-gx-box
-- Alola Collection: https://www.pokemon.com/uk/pokemon-tcg/product-gallery/alola-collection

do $$
declare
  changed_rows integer;
begin
  update public.product_contents
  set card_id = '90d3c073-77aa-478e-839a-32ed0626ef2d'
  where id = '3d40a54a-5987-4d09-a636-86c4abc6c235'
    and card_id is null
    and item_name = 'Amphinobi de Sacha-EX'
    and content_type = 'promo'
    and confidence = 'verified';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Ash-Greninja-EX content row, updated %', changed_rows;
  end if;

  update public.product_contents
  set card_id = '109e0a77-fa12-41e8-978d-dab5f09c75f1'
  where id = '5d1f0f6a-e1ef-4742-89df-ef6609b60c6c'
    and card_id is null
    and item_name = 'Dracolosse-V'
    and content_type = 'promo'
    and confidence = 'verified';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Dragonite V content row, updated %', changed_rows;
  end if;

  update public.product_contents
  set card_id = '496d9545-d255-4ec7-ae24-c571ea9f04d1'
  where id = '92f595be-e327-46eb-9737-a854ae58e2b9'
    and card_id is null
    and item_name = 'Rayquaza-EX chromatique'
    and content_type = 'promo'
    and confidence = 'verified';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Shiny Rayquaza-EX content row, updated %', changed_rows;
  end if;

  update public.product_contents
  set card_id = 'ed6ed722-65b0-4f0b-9855-49ea57f09305'
  where id = '90ffe19f-1b6b-4618-bd25-4adae1534ae4'
    and card_id is null
    and item_name = 'Silvallié-GX chromatique'
    and content_type = 'promo'
    and confidence = 'verified';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Shiny Silvally-GX content row, updated %', changed_rows;
  end if;

  update public.product_contents
  set card_id = 'cdc8da87-47d8-4d9d-85c7-8fb08ccd7ff8'
  where id = '93932f8c-5d16-44d6-84a5-0355269aad30'
    and card_id is null
    and item_name = 'Tokorico-GX chromatique'
    and content_type = 'promo'
    and confidence = 'verified';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Shiny Tapu Koko-GX content row, updated %', changed_rows;
  end if;

  update public.product_contents
  set card_id = 'c56d35d5-6876-488e-99f0-8016d7e79ba1'
  where id = '6f0152ce-ba0c-4bc4-94b1-e3e2a0718e98'
    and card_id is null
    and item_name = 'Brindibou'
    and content_type = 'promo'
    and confidence = 'verified';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Rowlet content row for Alola Collection, updated %', changed_rows;
  end if;

  update public.product_contents
  set card_id = '03d221e6-680d-4ac5-b8e3-9c81d4332c83'
  where id = '6e8dc395-b920-4186-bd66-9c9ea625bac8'
    and card_id is null
    and item_name = 'Flamiaou'
    and content_type = 'promo'
    and confidence = 'verified';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Litten content row for Alola Collection, updated %', changed_rows;
  end if;

  update public.product_contents
  set card_id = '189b2d6a-0c61-47e4-929a-ac2883362611'
  where id = '3a235895-caef-41a3-b1f7-b7f55df97070'
    and card_id is null
    and item_name = 'Otaquin'
    and content_type = 'promo'
    and confidence = 'verified';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Popplio content row for Alola Collection, updated %', changed_rows;
  end if;
end
$$;
