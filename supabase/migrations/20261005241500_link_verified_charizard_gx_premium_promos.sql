-- Link the Charizard-GX, Charmander and Charmeleon promos from the Charizard-GX Premium Collection.
-- Pokémon confirms all three foil promos; the Charizard-GX promo is SM211, while the two evolution cards
-- are the Burning Shadows prints 18 and 19.
-- https://www.pokemon.com/uk/pokemon-tcg/product-gallery/charizard-gx-premium-collection
-- https://www.pokemon.com/uk/pokemon-tcg/pokemon-cards/series/smp/SM211/
-- https://bulbapedia.bulbagarden.net/wiki/Charizard-GX_(SM_Promo_211)

do $$
declare
  changed_rows integer;
begin
  update public.product_contents pc
  set card_id = mapping.card_id
  from (values
    ('e9058112-5fdd-45ee-b8cb-13e95c1c48bc'::uuid, '072ddb3a-6117-4267-adff-89841b21ecb2'::uuid, 'Dracaufeu-GX full-art', 'SM211', 'smp'),
    ('74bc57c4-559b-46c8-9bf7-55c5499c4a1f'::uuid, 'b2db4fc9-ea22-45fd-b44c-edd6bfbfa5d7'::uuid, 'Salamèche', '18', 'sm3'),
    ('60340164-af93-4a0e-b05a-393b5bbd8c53'::uuid, 'acd06d4f-6d5f-4b6c-8fa7-0b8dc2969c7e'::uuid, 'Reptincel', '19', 'sm3')
  ) as mapping(content_id, card_id, item_name, collector_number, set_code)
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
  if changed_rows <> 3 then
    raise exception 'Expected three verified Charizard-GX Premium Collection promo contents, updated %', changed_rows;
  end if;
end
$$;
