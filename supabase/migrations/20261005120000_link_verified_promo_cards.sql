-- Link verified promotional-card identities to their sealed products.
-- Evidence:
-- * Pokémon Legendary Collection includes Pikachu-EX; Pokémon's card database lists XY174 as Pikachu-EX.
--   https://www.pokemon.com/us/pokemon-tcg/product-gallery/legendary-collection
--   https://www.pokemon.com/us/pokemon-tcg/pokemon-cards/series/xyp/XY174/
-- * Pokémon's Shiny Kalos Tin includes special foil Xerneas-EX and Yveltal-EX cards; Pokémon's tournament deck database
--   identifies the corresponding XY promos as XY149 and XY150.
--   https://www.pokemon.com/uk/pokemon-tcg/product-gallery/shiny-kalos-tin
--   https://www.pokemon.com/us/play-pokemon/internationals/2017/oceania/tcg-juniors
-- * The French Coffret Némélios contains Némélios XY26.
--   https://www.pokemon.com/uk/pokemon-tcg/product-gallery/xy-pyroar-box
--   https://www.pokepedia.fr/Coffret_N%C3%A9m%C3%A9lios_(Carrefour)

do $$
declare
  changed_rows integer;
begin
  update public.product_contents
  set card_id = '03c5d444-0711-4330-8937-e330918291db'
  where id = '5b3de651-0b3d-4602-9a58-51976bc16cb0'
    and card_id is null
    and item_name = 'Pikachu-EX'
    and content_type = 'promo'
    and confidence = 'verified';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Pikachu-EX content row for Legendary Collection, updated %', changed_rows;
  end if;

  update public.product_contents
  set card_id = '2cc9e816-be65-466c-a4ea-41dda1e86c6a'
  where id = '6b97a3ce-bd09-4c94-90f8-7d4c2350a4f7'
    and card_id is null
    and item_name = 'Yveltal-EX'
    and content_type = 'promo'
    and confidence = 'verified';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Yveltal-EX content row for Shiny Kalos Tin, updated %', changed_rows;
  end if;

  update public.product_contents
  set card_id = 'ff3ae004-2d04-4795-8857-a8fc9feb6e76',
      source_url = 'https://www.pokepedia.fr/Coffret_N%C3%A9m%C3%A9lios_(Carrefour)',
      source_label = 'Poképédia – Coffret Némélios (Carrefour), promo XY26'
  where id = '8131e83d-14f5-495e-9340-ee4da16379b9'
    and card_id is null
    and item_name = 'Némélios'
    and content_type = 'promo'
    and confidence = 'verified';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Némélios content row for Coffret Némélios, updated %', changed_rows;
  end if;

  update public.product_contents
  set card_id = 'c634d84d-b57d-4f7e-b03c-b0f6b013db63'
  where id = '2aa8351b-48c2-40de-a6fc-23ab077fba5f'
    and card_id is null
    and item_name = 'Xerneas-EX'
    and content_type = 'promo'
    and confidence = 'verified';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Xerneas-EX content row for Shiny Kalos Tin, updated %', changed_rows;
  end if;
end
$$;
