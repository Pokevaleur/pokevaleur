-- Link the Xerneas and Yveltal Collection promos to XY05 and XY06.
-- The French collection references and XY promo checklist distinguish these figure/jumbo
-- collections from the Battle Arena decks, which use XY31 and XY32.
-- https://bulbapedia.bulbagarden.net/wiki/XY_French_TCG_Series_merchandise
-- https://bulbapedia.bulbagarden.net/wiki/XYP#Card_list
-- https://www.pokepedia.fr/Collection_Xerneas
-- https://www.pokepedia.fr/Xerneas_(Promo_XY_05)

do $$
declare
  changed_rows integer;
begin
  update public.product_contents pc
  set card_id = mapping.card_id
  from (values
    ('4d2b8d53-0f0e-4cc4-b48d-391cbb107f6b'::uuid, '5d976df1-969e-41dd-bd7c-13b6d4e2fe9b'::uuid, 'Xerneas', 'XY05'),
    ('082740c8-5bf8-446f-bdad-a3b4c70c589c'::uuid, 'e56d33f4-32ae-4930-bb8e-7809d5bf982d'::uuid, 'Yveltal', 'XY06')
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
    raise exception 'Expected two verified Xerneas/Yveltal Collection promos, updated %', changed_rows;
  end if;
end
$$;
