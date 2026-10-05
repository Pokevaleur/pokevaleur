-- Link the verified Hoopa-EX promo from the Hoopa Legendary Collection to XY71.
-- Pokémon's product gallery confirms the Hoopa-EX variant includes a foil promo card;
-- Pokémon's card database and promo reference identify this card as XY71.
-- https://www.pokemon.com/us/pokemon-tcg/product-gallery/legendary-collection/
-- https://www.pokemon.com/uk/pokemon-tcg/pokemon-cards/series/xyp/XY85/
-- https://bulbapedia.bulbagarden.net/wiki/Hoopa-EX_%28XY_Promo_71%29

do $$
declare
  changed_rows integer;
begin
  update public.product_contents pc
  set card_id = '45208845-7994-4dc6-bf16-76393b7e19b3'::uuid
  where pc.id = '60f53cd7-bfaf-4243-9aaf-26bedfc0fcfe'::uuid
    and pc.card_id is null
    and pc.item_name = 'Hoopa-EX'
    and pc.content_type = 'promo'
    and pc.confidence = 'verified'
    and exists (
      select 1
      from public.cards c
      join public.card_sets s on s.id = c.card_set_id
      where c.id = '45208845-7994-4dc6-bf16-76393b7e19b3'::uuid
        and c.collector_number = 'XY71'
        and s.set_code = 'xyp'
    );
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Hoopa Legendary Collection promo content, updated %', changed_rows;
  end if;
end
$$;
