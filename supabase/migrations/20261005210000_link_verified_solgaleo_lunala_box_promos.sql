-- Link the verified Solgaleo-GX and Lunala-GX box promos to SM16 and SM17.
-- Pokémon's product gallery confirms the Solgaleo-GX/Lunala-GX box promos; Pokémon's card database
-- and promo checklist identify the two cards as SM16 and SM17 respectively.
-- https://www.pokemon.com/fr/jcc-pokemon/galerie-produits/coffrets-solgaleo-gx-et-lunala-gx/
-- https://www.pokemon.com/fr/jcc-pokemon/cartes-pokemon/series/smp/SM17/
-- https://donnees.xn--pokpdia-dyab.fr/Promo_SM

do $$
declare
  changed_rows integer;
begin
  update public.product_contents pc
  set card_id = mapping.card_id
  from (values
    ('fd8c4731-ce38-40e9-981a-a5587c0644ee'::uuid, '1b419e5f-80e0-4336-812e-ab421147140a'::uuid, 'Solgaleo-GX', 'SM16'),
    ('2305f4d8-f9be-4b8c-a482-a0dea0deb7cd'::uuid, 'e7a2021a-df42-4099-bb93-85ee0eb8461c'::uuid, 'Lunala-GX', 'SM17')
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
    raise exception 'Expected two verified Solgaleo-GX/Lunala-GX promo contents, updated %', changed_rows;
  end if;
end
$$;
