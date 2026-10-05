-- Link the Charizard-GX promo in the Detective Pikachu Case File to SM195.
-- Pokémon's product page confirms a foil Charizard-GX promo; the card availability
-- page names this Case File as the source of Charizard-GX SM195.
-- https://www.pokemon.com/us/pokemon-tcg/product-gallery/detective-pikachu-charizard-gx-case-file
-- https://www.pokemon.com/us/pokemon-tcg/detective-pikachu/card-availability/

do $$
declare
  changed_rows integer;
begin
  update public.product_contents
  set card_id = '19f86108-ff90-4c25-9469-878fb5747040'
  where id = '11f639f7-72df-430c-8c59-e3649400f9ad'
    and card_id is null
    and item_name = 'Dracaufeu-GX'
    and content_type = 'promo'
    and confidence = 'verified'
    and exists (
      select 1 from public.cards c
      join public.card_sets s on s.id = c.card_set_id
      where c.id = '19f86108-ff90-4c25-9469-878fb5747040'
        and s.set_code = 'smp' and c.collector_number = 'SM195'
    );
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Charizard-GX promo content for Detective Pikachu Case File, updated %', changed_rows;
  end if;
end
$$;
