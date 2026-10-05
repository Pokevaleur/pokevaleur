-- Link three additional product-specific promos with verified collector numbers.
-- * Alolan Raichu Figure Collection: Alolan Raichu SM65.
--   https://www.pokemon.com/us/pokemon-tcg/product-gallery/alolan-raichu-figure-collection/
--   https://www.pokepedia.fr/Raichu_d%27Alola_(Promo_SM_65)
-- * Reshiram & Charizard-GX Figure Collection: SM201.
--   https://www.pokemon.com/uk/pokemon-tcg/product-gallery/reshiram-charizard-gx-figure-collection
--   https://bulbapedia.bulbagarden.net/wiki/SM_Black_Star_Promos
-- * Lucario VSTAR Premium Collection: SWSH214.
--   https://www.pokemon.com/uk/pokemon-tcg/product-gallery/lucario-vstar-premium-collection
--   https://bulbapedia.bulbagarden.net/wiki/SWSH_Black_Star_Promos

do $$
declare
  changed_rows integer;
begin
  update public.product_contents
  set card_id = '87125718-aa98-40e6-96f2-400baa277abf'
  where id = 'd49e4ffa-1c6c-4549-bc3f-d9d542476088'
    and card_id is null
    and item_name = 'Raichu d’Alola'
    and content_type = 'promo'
    and confidence = 'verified'
    and exists (
      select 1 from public.cards c
      join public.card_sets s on s.id = c.card_set_id
      where c.id = '87125718-aa98-40e6-96f2-400baa277abf'
        and s.set_code = 'smp' and c.collector_number = 'SM65'
    );
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Alolan Raichu promo content for Alolan Raichu Figure Collection, updated %', changed_rows;
  end if;

  update public.product_contents
  set card_id = '4ff42160-3f9c-4710-8cca-e09ee4acde09'
  where id = '26cab772-5312-458a-b391-9d447eb027c3'
    and card_id is null
    and item_name = 'Reshiram et Dracaufeu-GX'
    and content_type = 'promo'
    and confidence = 'verified'
    and exists (
      select 1 from public.cards c
      join public.card_sets s on s.id = c.card_set_id
      where c.id = '4ff42160-3f9c-4710-8cca-e09ee4acde09'
        and s.set_code = 'smp' and c.collector_number = 'SM201'
    );
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Reshiram and Charizard-GX promo content, updated %', changed_rows;
  end if;

  update public.product_contents
  set card_id = '55a3e5eb-a0f7-4382-8b5f-b241cf0c0320'
  where id = '799f9624-48c1-4445-bf51-bbd9b33411eb'
    and card_id is null
    and item_name = 'Lucario-VSTAR'
    and content_type = 'promo'
    and confidence = 'verified'
    and exists (
      select 1 from public.cards c
      join public.card_sets s on s.id = c.card_set_id
      where c.id = '55a3e5eb-a0f7-4382-8b5f-b241cf0c0320'
        and s.set_code = 'swshp' and c.collector_number = 'SWSH214'
    );
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Lucario VSTAR promo content for Lucario VSTAR Premium Collection, updated %', changed_rows;
  end if;
end
$$;
