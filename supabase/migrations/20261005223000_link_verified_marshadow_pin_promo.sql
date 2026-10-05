-- Link the verified Marshadow promo in the Shining Legends Pin Collection to SM93.
-- Pokémon confirms a unique foil Marshadow promo in the box; the promo checklist and Pokémon card database
-- identify the card as SM93.
-- https://www.pokemon.com/uk/pokemon-tcg/product-gallery/shining-legends-pin-collection-marshadow
-- https://www.pokemon.com/us/pokemon-tcg/pokemon-cards/series/smp/SM93/
-- https://bulbapedia.bulbagarden.net/wiki/Marshadow_%28SM-P_Promo_123%29

do $$
declare
  changed_rows integer;
begin
  update public.product_contents pc
  set card_id = 'bdf0d609-675a-4254-a439-502b1e3dbfbd'::uuid
  where pc.id = 'b8008168-8781-4bbd-81c5-f36dbed99dfe'::uuid
    and pc.card_id is null
    and pc.item_name = 'Marshadow'
    and pc.content_type = 'promo'
    and pc.confidence = 'verified'
    and exists (
      select 1
      from public.cards c
      join public.card_sets s on s.id = c.card_set_id
      where c.id = 'bdf0d609-675a-4254-a439-502b1e3dbfbd'::uuid
        and c.collector_number = 'SM93'
        and s.set_code = 'smp'
    );
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Shining Legends Marshadow promo content, updated %', changed_rows;
  end if;
end
$$;
