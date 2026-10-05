-- Link the verified gold Pikachu V and Poké Ball promos from the Celebrations Ultra-Premium Collection.
-- Pokémon confirms both etched-gold promo cards; the SWSH promo checklist identifies them as SWSH145 and SWSH146.
-- https://www.pokemon.com/us/pokemon-tcg/product-gallery/celebrations-ultra-premium-collection
-- https://bulbapedia.bulbagarden.net/wiki/SWSH_Black_Star_Promos_(TCG)

do $$
declare
  changed_rows integer;
begin
  update public.product_contents pc
  set card_id = mapping.card_id
  from (values
    ('2bd16e07-2e53-4c3f-aa51-630699443562'::uuid, '64d39997-16a8-438d-89bb-780a07d8fa27'::uuid, 'Pikachu V doré', 'SWSH145', 'swshp'),
    ('84903c01-d926-4fb6-838c-f970253180ce'::uuid, 'f5eaebec-ba61-4fa6-b90f-b1cf4f898b8f'::uuid, 'Poké Ball dorée', 'SWSH146', 'swshp')
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
    raise exception 'Expected two verified Celebrations Ultra-Premium promo contents, updated %', changed_rows;
  end if;
end
$$;
