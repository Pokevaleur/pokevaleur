-- Link the verified Celebi V and Mew V contents of the Mythical Squishy Premium Collection.
-- Pokémon confirms the three V cards in the collection; the promo/product checklist identifies
-- these non-exclusive reprints as Sword & Shield 001 (Celebi V) and Darkness Ablaze 069 (Mew V).
-- https://www.pokemon.com/uk/pokemon-tcg/product-gallery/mythical-squishy-premium-collection/
-- https://bulbapedia.bulbagarden.net/wiki/Morpeko_V-UNION_Special_Collection

do $$
declare
  changed_rows integer;
begin
  update public.product_contents pc
  set card_id = mapping.card_id
  from (values
    ('1876d357-b4cd-414f-b493-ef499ed7e057'::uuid, '92fe051d-5492-486b-bf1f-246bfa4c3a40'::uuid, 'Celebi-V', '1', 'swsh1'),
    ('86d50a5f-856b-4b5f-9930-4febd8f92d6b'::uuid, '85b0eb5e-a116-4be3-9e85-5af05ea6b266'::uuid, 'Mew-V', '69', 'swsh3')
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
  if changed_rows <> 2 then
    raise exception 'Expected two verified Mythical Squishy collection contents, updated %', changed_rows;
  end if;
end
$$;
