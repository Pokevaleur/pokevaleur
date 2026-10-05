-- Link two individually verified promo-card identities to their sealed products.
-- Evidence:
-- * Pokémon Legendary Collection includes Pikachu-EX; Pokémon's card database lists XY174 as Pikachu-EX.
--   https://www.pokemon.com/us/pokemon-tcg/product-gallery/legendary-collection
--   https://www.pokemon.com/us/pokemon-tcg/pokemon-cards/series/xyp/XY174/
-- * Pokémon's Shiny Kalos Tin includes a special foil Shiny Yveltal-EX; the corresponding XY promo is XY150a.
--   https://www.pokemon.com/uk/pokemon-tcg/product-gallery/shiny-kalos-tin
--   Pokémon tournament deck records identify Yveltal-EX XY150 as PR-XY; XY150a is the Shiny Kalos Tin print.
--   https://www.pokemon.com/us/play-pokemon/regionals/2017/athens/tcg-juniors

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
  set card_id = '14506668-cd62-46a2-b693-639caf0662ac'
  where id = '6b97a3ce-bd09-4c94-90f8-7d4c2350a4f7'
    and card_id is null
    and item_name = 'Yveltal-EX'
    and content_type = 'promo'
    and confidence = 'verified';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Yveltal-EX content row for Shiny Kalos Tin, updated %', changed_rows;
  end if;
end
$$;
