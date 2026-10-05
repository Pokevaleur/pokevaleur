-- Link the verified Mewtwo-EX promo from the Generations Super-Premium Collection to XY125.
-- Pokémon's product gallery identifies the Super-Premium Collection contents; the XY promo checklist maps XY125 to Mewtwo-EX.
-- https://www.pokemon.com/us/pokemon-tcg/product-gallery/generations-super-premium-collection
-- https://bulbapedia.bulbagarden.net/wiki/XY_Black_Star_Promos_(TCG)
-- https://den-media.pokellector.com/checklists/XY%20XY%20Promos%20Checklist.pdf

do $$
declare
  changed_rows integer;
begin
  update public.product_contents pc
  set card_id = mapping.card_id
  from (values
    ('a335a337-7add-44cc-b21b-573b1786a2f9'::uuid, '5eb582d9-d4d4-4b94-a3da-8131339844e8'::uuid, 'Mewtwo-EX', 'XY125')
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
        and s.set_code = 'xyp'
    );
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one verified Mewtwo-EX promo content, updated %', changed_rows;
  end if;
end
$$;
