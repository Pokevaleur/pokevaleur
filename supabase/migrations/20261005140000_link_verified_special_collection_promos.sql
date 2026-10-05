-- Link five product-specific promos whose collector numbers are confirmed.
-- Product pages and cross-checks:
-- * Shining Legends Super-Premium Collection: Ho-Oh-GX SM80 and Pikachu SM81.
--   https://www.pokemon.com/us/pokemon-tcg/product-gallery/shining-legends-super-premium-collection-featuring-ho-oh/
--   https://bulbapedia.bulbagarden.net/wiki/SM_Black_Star_Promos
-- * Sword & Shield Figure Collection: Pikachu SWSH020.
--   https://www.pokemon.com/uk/pokemon-tcg/product-gallery/sword-shield-figure-collection
--   https://bulbapedia.bulbagarden.net/wiki/SWSH_Black_Star_Promos
-- * Shining Fates Pikachu V Collection: Pikachu V SWSH061.
--   https://www.pokemon.com/us/pokemon-tcg/product-gallery/shining-fates-collection-pikachu-v/
--   https://bulbapedia.bulbagarden.net/wiki/SWSH_Black_Star_Promos
-- * Arceus V Figure Collection: Arceus V SWSH204.
--   https://www.pokemon.com/uk/pokemon-tcg/product-gallery/arceus-v-figure-collection
--   https://bulbapedia.bulbagarden.net/wiki/SWSH_Black_Star_Promos

do $$
declare
  changed_rows integer;
begin
  update public.product_contents
  set card_id = '11e2ea92-d916-42df-ac2e-03472515fd78'
  where id = 'fbe455e0-4503-4f58-973e-d2e8456d253f'
    and card_id is null
    and item_name = 'Ho-Oh-GX arc-en-ciel'
    and content_type = 'promo'
    and confidence = 'verified'
    and exists (
      select 1 from public.cards c
      join public.card_sets s on s.id = c.card_set_id
      where c.id = '11e2ea92-d916-42df-ac2e-03472515fd78'
        and s.set_code = 'smp' and c.collector_number = 'SM80'
    );
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Ho-Oh-GX promo content for Shining Legends Super-Premium Collection, updated %', changed_rows;
  end if;

  update public.product_contents
  set card_id = 'aa21486d-8bd2-46ab-885b-f99b787e32a4'
  where id = 'f15322ec-adc6-4274-896a-1e01d949d008'
    and card_id is null
    and item_name = 'Pikachu'
    and content_type = 'promo'
    and confidence = 'verified'
    and exists (
      select 1 from public.cards c
      join public.card_sets s on s.id = c.card_set_id
      where c.id = 'aa21486d-8bd2-46ab-885b-f99b787e32a4'
        and s.set_code = 'smp' and c.collector_number = 'SM81'
    );
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Pikachu promo content for Shining Legends Super-Premium Collection, updated %', changed_rows;
  end if;

  update public.product_contents
  set card_id = '2f0b88bc-cc76-47d5-a951-41dca4dff416'
  where id = '5dbd1f6a-2752-463a-8942-d377bbb67702'
    and card_id is null
    and item_name = 'Pikachu full-art'
    and content_type = 'promo'
    and confidence = 'verified'
    and exists (
      select 1 from public.cards c
      join public.card_sets s on s.id = c.card_set_id
      where c.id = '2f0b88bc-cc76-47d5-a951-41dca4dff416'
        and s.set_code = 'swshp' and c.collector_number = 'SWSH020'
    );
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Pikachu full-art promo content for Sword & Shield Figure Collection, updated %', changed_rows;
  end if;

  update public.product_contents
  set card_id = 'a6dd4dc0-b539-4a09-a424-f2ff27654983'
  where id = '32e4f5c6-3d75-47a8-a1cb-50649fbead8d'
    and card_id is null
    and item_name = 'Pikachu-V'
    and content_type = 'promo'
    and confidence = 'verified'
    and exists (
      select 1 from public.cards c
      join public.card_sets s on s.id = c.card_set_id
      where c.id = 'a6dd4dc0-b539-4a09-a424-f2ff27654983'
        and s.set_code = 'swshp' and c.collector_number = 'SWSH061'
    );
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Pikachu-V promo content for Shining Fates Collection, updated %', changed_rows;
  end if;

  update public.product_contents
  set card_id = 'f26b4d4a-9aad-438e-9c8b-bf06ee227b1b'
  where id = '29fa29b1-6d09-462f-9c22-c6d30ca47ced'
    and card_id is null
    and item_name = 'Arceus-V'
    and content_type = 'promo'
    and confidence = 'verified'
    and exists (
      select 1 from public.cards c
      join public.card_sets s on s.id = c.card_set_id
      where c.id = 'f26b4d4a-9aad-438e-9c8b-bf06ee227b1b'
        and s.set_code = 'swshp' and c.collector_number = 'SWSH204'
    );
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Arceus-V promo content for Arceus V Figure Collection, updated %', changed_rows;
  end if;
end
$$;
