-- Link the verified Entei-GX promo from the Legends of Johto GX Collection.
-- Pokémon confirms Entei-GX as a foil promo in the product; the promo checklist identifies its
-- alternate-art print as Shining Legends 10a (catalog card number 10).
-- https://www.pokemon.com/uk/pokemon-tcg/product-gallery/legends-of-johto-gx-collection/
-- https://bulbapedia.bulbagarden.net/wiki/Legends_of_Johto_GX_Premium_Collection

do $$
declare
  changed_rows integer;
begin
  update public.product_contents pc
  set card_id = 'e466233e-2374-4de6-93a3-e9fd978f6c2f'::uuid
  where pc.id = '9dc7be59-7245-43da-a75d-28874a08fd0f'::uuid
    and pc.card_id is null
    and pc.item_name = 'Entei-GX'
    and pc.content_type = 'promo'
    and pc.confidence = 'verified'
    and exists (
      select 1
      from public.cards c
      join public.card_sets s on s.id = c.card_set_id
      where c.id = 'e466233e-2374-4de6-93a3-e9fd978f6c2f'::uuid
        and c.collector_number = '10'
        and s.set_code = 'sm3.5'
    );
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Legends of Johto Entei-GX promo content, updated %', changed_rows;
  end if;
end
$$;
