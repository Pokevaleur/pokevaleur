do $$
declare
  display_id uuid;
  display_name text := 'Display de 10 Kits AP Écarlate et Violet – Aventures Ensemble';
  product_series text := 'Écarlate et Violet – Aventures Ensemble';
begin
  select id into display_id
  from public.products
  where name = display_name
    and series = product_series
    and product_type = 'Display de Kits AP'
  order by created_at, id
  limit 1;

  if display_id is null then
    insert into public.products (
      name, category, series, currency, is_public, product_type, release_year,
      case_unit_count, case_reference, case_packaging_note
    ) values (
      display_name, 'sealed', product_series, 'EUR', true, 'Display de Kits AP', 2025,
      10, '0196214108141',
      'Contient 10 Boîtiers Stratégies et Combats Aventures Ensemble. Chaque Kit AP contient 4 boosters, soit 40 boosters au total.'
    ) returning id into display_id;
  else
    update public.products
    set category = 'sealed',
        currency = 'EUR',
        is_public = true,
        release_year = 2025,
        case_unit_count = 10,
        case_reference = '0196214108141',
        case_packaging_note = 'Contient 10 Boîtiers Stratégies et Combats Aventures Ensemble. Chaque Kit AP contient 4 boosters, soit 40 boosters au total.'
    where id = display_id;
  end if;

  insert into public.product_contents (
    product_id, content_type, item_name, quantity, source_label, confidence, content_role
  )
  select display_id, 'other', 'Kit AP Écarlate et Violet – Aventures Ensemble (4 boosters)', 10,
         'Emballage du produit', 'verified', 'guaranteed'
  where not exists (
    select 1 from public.product_contents
    where product_id = display_id
      and content_type = 'other'
      and item_name = 'Kit AP Écarlate et Violet – Aventures Ensemble (4 boosters)'
      and content_role = 'guaranteed'
  );
end $$;
