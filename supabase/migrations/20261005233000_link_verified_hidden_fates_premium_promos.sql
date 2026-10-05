-- Link the three verified Hidden Fates Premium Powers / Ultra-Premium Collection promos.
-- Pokémon confirms Shiny Rayquaza-GX and the gold Solgaleo-GX/Lunala-GX cards in the Premium Powers Collection;
-- promo references identify the prints as Rayquaza-GX 177a/168, Lunala-GX SM103, and Solgaleo-GX SM104.
-- The Ultra-Premium version contains the same three cards.
-- https://www.pokemon.com/uk/pokemon-tcg/product-gallery/hidden-fates-premium-powers-collection
-- https://www.pokepedia.fr/Collection_Pouvoirs_Premium_Destin%C3%A9es_Occultes
-- https://www.pokebeach.com/2019/08/hidden-fates-ultra-premium-collection-product-contents

do $$
declare
  changed_rows integer;
begin
  update public.product_contents pc
  set card_id = mapping.card_id
  from (values
    ('06b7ffba-d613-4ba3-99c8-b3e76bb58149'::uuid, '5f5c25fa-90aa-4b66-a448-744dacf18309'::uuid, 'Lunala-GX doré', 'SM103', 'smp'),
    ('b200621c-1226-4254-b3b2-1fc0f3eb2029'::uuid, 'd76ee652-c676-49d5-8f4d-d25db7b4e9d3'::uuid, 'Rayquaza-GX chromatique full-art', '177', 'sm7'),
    ('571edf72-89d6-472a-996a-3982eb6a21d4'::uuid, '7a8fe1f9-4808-45a3-a085-0179f8f9b3b6'::uuid, 'Solgaleo-GX doré', 'SM104', 'smp'),
    ('e884b42c-9c14-499d-be25-e753ad4e7344'::uuid, '5f5c25fa-90aa-4b66-a448-744dacf18309'::uuid, 'Lunala-GX doré', 'SM103', 'smp'),
    ('d1e94731-8bca-4fc4-af8f-b0dfae81cadf'::uuid, 'd76ee652-c676-49d5-8f4d-d25db7b4e9d3'::uuid, 'Rayquaza-GX chromatique full-art', '177', 'sm7'),
    ('ccc39c4b-cdfa-46b1-b18f-ee4df4fe55a6'::uuid, '7a8fe1f9-4808-45a3-a085-0179f8f9b3b6'::uuid, 'Solgaleo-GX doré', 'SM104', 'smp')
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
  if changed_rows <> 6 then
    raise exception 'Expected six verified Hidden Fates Premium Powers/Ultra-Premium contents, updated %', changed_rows;
  end if;
end
$$;
