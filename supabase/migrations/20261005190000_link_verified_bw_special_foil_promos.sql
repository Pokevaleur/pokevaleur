-- Link four additional verified foil promos to their exact catalog cards.
-- The Sylveon Collection source identifies the XY04 promo; Pokémon's product page
-- confirms the Unova dragons promos, and the print references identify each underlying card.
-- https://www.pokemon.com/us/pokemon-tcg/product-gallery/bw-sylveon-collection
-- https://bulbapedia.bulbagarden.net/wiki/Sylveon_(XY-P_Promo_91)
-- https://www.pokemon.com/us/pokemon-tcg/product-gallery/bw-legendary-dragons-collection
-- https://bulbapedia.bulbagarden.net/wiki/Kyurem_(Noble_Victories_34)
-- https://bulbapedia.bulbagarden.net/wiki/Reshiram_(Plasma_Freeze_17)
-- https://bulbapedia.bulbagarden.net/wiki/Zekrom_(Plasma_Freeze_39)

do $$
declare
  changed_rows integer;
begin
  update public.product_contents pc
  set card_id = mapping.card_id
  from (values
    ('336652e1-758a-4238-aa9f-ef9c51934296'::uuid, '1932a8d2-a4ef-46f8-af9e-e2cebd9f908b'::uuid, 'Nymphali holographique', 'xyp', 'XY04'),
    ('988cf5c1-7087-4b8e-a16b-d291c0288c0e'::uuid, '02733806-bff4-42b3-b67d-d58b2ade1ee3'::uuid, 'Kyurem holographique', 'bw3', '34'),
    ('7aee29f6-7c8a-44bc-86ae-6d96911180fe'::uuid, 'b86e683b-f877-4ea7-bf0b-8f90854bc328'::uuid, 'Reshiram holographique', 'bw9', '17'),
    ('7a139e73-fe28-473d-a031-a026d6629b8c'::uuid, 'b11c08c6-dd53-4223-9b15-1281f5ce0972'::uuid, 'Zekrom holographique', 'bw9', '39')
  ) as mapping(content_id, card_id, item_name, set_code, collector_number)
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
        and s.set_code = mapping.set_code
    );
  get diagnostics changed_rows = row_count;
  if changed_rows <> 4 then
    raise exception 'Expected four verified foil promo contents, updated %', changed_rows;
  end if;
end
$$;
