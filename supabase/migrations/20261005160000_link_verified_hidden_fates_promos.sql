-- Link the two Hidden Fates Collection promos to their exact SM promo cards.
-- Pokémon confirms each collection contains a foil promo featuring the named Pokémon;
-- the SM Black Star Promo references confirm the printed numbers.
-- https://www.pokemon.com/us/pokemon-tcg/product-gallery/hidden-fates-collection-charizard-gx-raichu-gx-or-gyarados-gx
-- https://bulbapedia.bulbagarden.net/wiki/Charizard-GX_(SM_Promo_211)
-- https://bulbapedia.bulbagarden.net/wiki/Raichu-GX_(SM_Promo_213)

do $$
declare
  changed_rows integer;
begin
  update public.product_contents
  set card_id = '072ddb3a-6117-4267-adff-89841b21ecb2'
  where id = '1300bf36-9f11-4621-ada0-96afda792099'
    and card_id is null
    and item_name = 'Dracaufeu-GX'
    and content_type = 'promo'
    and confidence = 'verified'
    and exists (
      select 1 from public.cards c
      join public.card_sets s on s.id = c.card_set_id
      where c.id = '072ddb3a-6117-4267-adff-89841b21ecb2'
        and s.set_code = 'smp' and c.collector_number = 'SM211'
    );
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Charizard-GX promo content for Hidden Fates Collection, updated %', changed_rows;
  end if;

  update public.product_contents
  set card_id = '55a2e3e5-baf3-4af2-bdfd-41c689c609db'
  where id = '18b96ee6-0f5b-4c78-8a10-7002f78db1ed'
    and card_id is null
    and item_name = 'Raichu-GX'
    and content_type = 'promo'
    and confidence = 'verified'
    and exists (
      select 1 from public.cards c
      join public.card_sets s on s.id = c.card_set_id
      where c.id = '55a2e3e5-baf3-4af2-bdfd-41c689c609db'
        and s.set_code = 'smp' and c.collector_number = 'SM213'
    );
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Raichu-GX promo content for Hidden Fates Collection, updated %', changed_rows;
  end if;
end
$$;
