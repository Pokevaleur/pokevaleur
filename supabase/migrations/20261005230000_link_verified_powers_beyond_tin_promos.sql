-- Link the verified Hoopa-EX and Rayquaza-EX variants of the Powers Beyond Tins.
-- Pokémon's product page confirms these are among the tin promo variants; its card database and
-- the XY promo checklist identify Hoopa-EX as XY71 and Rayquaza-EX as XY73.
-- https://www.pokemon.com/uk/pokemon-tcg/product-gallery/xy-powers-beyond-tin
-- https://www.pokemon.com/uk/pokemon-tcg/pokemon-cards/series/xyp/XY85/
-- https://www.pokemon.com/uk/pokemon-tcg/pokemon-cards/series/xyp/XY73/
-- https://bulbapedia.bulbagarden.net/wiki/XY_Black_Star_Promos

do $$
declare
  changed_rows integer;
begin
  update public.product_contents pc
  set card_id = mapping.card_id
  from (values
    ('1c607885-4716-41b3-9f6f-5e09ce6c04f0'::uuid, '45208845-7994-4dc6-bf16-76393b7e19b3'::uuid, 'Hoopa-EX', 'XY71'),
    ('8364de59-24f2-401d-be75-4941e293d476'::uuid, 'eb5505a0-561b-46c1-bfb5-7aaf5d1fa971'::uuid, 'Rayquaza-EX', 'XY73')
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
  if changed_rows <> 2 then
    raise exception 'Expected two verified Powers Beyond Tin promo contents, updated %', changed_rows;
  end if;
end
$$;
