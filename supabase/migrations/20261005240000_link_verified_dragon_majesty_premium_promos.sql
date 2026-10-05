-- Link the verified Dragonite-GX and Kingdra-GX Rainbow promos from the Dragon Majesty Premium Powers Collection.
-- Pokémon's official product page confirms both Rainbow foil promos; the promo checklist identifies
-- them as SM156 (Dragonite-GX) and SM155 (Kingdra-GX).
-- https://www.pokemon.com/uk/pokemon-tcg/product-gallery/dragon-majesty-premium-powers-collection
-- https://bulbapedia.bulbagarden.net/wiki/Legends_of_Johto_GX_Premium_Collection

do $$
declare
  changed_rows integer;
begin
  update public.product_contents pc
  set card_id = mapping.card_id
  from (values
    ('6f29d097-014c-4b5b-aec6-1586a911b5f0'::uuid, '7351f57b-7a10-4547-8704-ac26e7f22db7'::uuid, 'Dracolosse-GX arc-en-ciel', 'SM156'),
    ('e3615900-de75-4dee-8d25-10785a341624'::uuid, '489dbe30-286a-41c4-bdfd-c968e2c39c40'::uuid, 'Hyporoi-GX arc-en-ciel', 'SM155')
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
        and s.set_code = 'smp'
    );
  get diagnostics changed_rows = row_count;
  if changed_rows <> 2 then
    raise exception 'Expected two verified Dragon Majesty Premium Powers promo contents, updated %', changed_rows;
  end if;
end
$$;
