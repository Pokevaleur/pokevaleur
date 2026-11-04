-- Split the combined Temporal Forces ETB catalogue row into its two French
-- variants while retaining the original row ID and all its existing links.
-- Also record current market quotes for ME03, ME04, and ME05.
begin;

update public.products
set current_value = 60.00,
    price_source = 'Médiane des ventes conclues sur 30 j (eBay.fr + GCC), CollectValue · 61 ventes/90 j · relevé du 04/11/2026',
    price_source_url = 'https://collectvalue.fr/trading-cards/pokemon/mega-evolution/equilibre-parfait-me03/sealed/etb-equilibre-parfait-865406',
    price_updated_at = now()
where id = '707358fe-9886-4a74-81ee-0d33e0cf0144'
  and category = 'sealed'
  and product_type = 'ETB';

update public.products
set current_value = 65.00,
    price_source = 'Médiane des ventes conclues sur 30 j (eBay.fr + GCC), CollectValue · 119 ventes/90 j · relevé du 04/11/2026',
    price_source_url = 'https://collectvalue.fr/trading-cards/pokemon/mega-evolution/chaos-ascendant-me04/sealed/etb-chaos-ascendant-877294',
    price_updated_at = now()
where id = 'e6418c97-7137-4357-bff3-2094fcda0746'
  and category = 'sealed'
  and product_type = 'ETB';

update public.products
set current_value = 75.00,
    price_source = 'Médiane des ventes conclues sur 30 j (eBay.fr + GCC), CollectValue · 189 ventes/90 j · relevé du 04/11/2026',
    price_source_url = 'https://collectvalue.fr/trading-cards/pokemon/mega-evolution/nuit-noire-me05/sealed/etb-nuit-noire-885542',
    price_updated_at = now()
where id = 'b6a64cdb-8a35-4090-bd7d-70ef69408a35'
  and category = 'sealed'
  and product_type = 'ETB';

do $$
declare
  v_original_id uuid := '8466668d-a7f8-4a08-b5ab-1e5286500a94';
  v_serpente_name text := 'Coffret Dresseur d’élite Écarlate et Violet – Forces Temporelles – Serpente-Eau';
  v_iron_name text := 'Coffret Dresseur d’élite Écarlate et Violet – Forces Temporelles – Vert-de-Fer';
  v_new_id uuid;
begin
  -- Keep the existing ID (and its ten product-content rows) on Serpente-Eau.
  update public.products
  set name = v_serpente_name,
      release_date = date '2024-03-22',
      release_year = 2024,
      image_url = 'https://www.pokepedia.fr/images/a/ab/Coffret_Dresseur_d%27%C3%A9lite_%C3%89carlate_et_Violet_Forces_Temporelles_Serpente-Eau.png',
      image_source_url = 'https://www.pokepedia.fr/Fichier:Coffret_Dresseur_d%27%C3%A9lite_%C3%89carlate_et_Violet_Forces_Temporelles_Serpente-Eau.png',
      image_credit = 'Poképédia — Coffret Serpente-Eau',
      official_source_url = 'https://www.pokemon.com/fr/jcc-pokemon/galerie-produits/coffret-dresseur-delite-ecarlate-et-violet-forces-temporelles',
      current_value = 114.43,
      price_source = 'Tendance Cardmarket via Pokescam · relevé du 04/11/2026',
      price_source_url = 'https://pokescam.com/items/etb-forces-temporelles-serpente-eau/',
      price_updated_at = now()
  where id = v_original_id
    and category = 'sealed'
    and product_type = 'ETB';

  -- Reuse an existing Vert-de-Fer variant if one was added since inspection;
  -- otherwise create it without disturbing any other catalogue row.
  select id into v_new_id
  from public.products
  where category = 'sealed'
    and product_type = 'ETB'
    and name = v_iron_name
  limit 1;

  if v_new_id is null then
    insert into public.products (
      name, category, series, release_date, release_year, image_url,
      image_source_url, image_credit, image_usage_status, language,
      product_type, is_public, official_source_url, current_value,
      price_source, price_source_url, price_updated_at
    )
    select
      v_iron_name, category, series, date '2024-03-22', 2024,
      'https://www.pokepedia.fr/images/0/02/Coffret_Dresseur_d%27%C3%A9lite_%C3%89carlate_et_Violet_Forces_Temporelles_Vert-de-Fer.png',
      'https://www.pokepedia.fr/Fichier:Coffret_Dresseur_d%27%C3%A9lite_%C3%89carlate_et_Violet_Forces_Temporelles_Vert-de-Fer.png',
      'Poképédia — Coffret Vert-de-Fer', image_usage_status, language,
      product_type, is_public,
      'https://www.pokemon.com/fr/jcc-pokemon/galerie-produits/coffret-dresseur-delite-ecarlate-et-violet-forces-temporelles',
      104.97,
      'Tendance Cardmarket via Pokescam · relevé du 04/11/2026',
      'https://pokescam.com/items/etb-forces-temporelles-vert-de-fer/', now()
    from public.products
    where id = v_original_id
    returning id into v_new_id;

    insert into public.product_contents (
      product_id, content_type, item_name, quantity, source_url,
      source_label, confidence, card_id, content_role
    )
    select
      v_new_id, content_type, item_name, quantity, source_url,
      source_label, confidence, card_id, content_role
    from public.product_contents
    where product_id = v_original_id;

    insert into public.product_expected_booster_series (
      product_id, series_name, expected_quantity, source_label, source_url, confidence
    )
    select
      v_new_id, series_name, expected_quantity, source_label, source_url, confidence
    from public.product_expected_booster_series
    where product_id = v_original_id
    on conflict do nothing;
  else
    update public.products
    set current_value = 104.97,
        price_source = 'Tendance Cardmarket via Pokescam · relevé du 04/11/2026',
        price_source_url = 'https://pokescam.com/items/etb-forces-temporelles-vert-de-fer/',
        price_updated_at = now(),
        release_date = coalesce(release_date, date '2024-03-22'),
        release_year = coalesce(release_year, 2024),
        image_url = 'https://www.pokepedia.fr/images/0/02/Coffret_Dresseur_d%27%C3%A9lite_%C3%89carlate_et_Violet_Forces_Temporelles_Vert-de-Fer.png',
        image_source_url = 'https://www.pokepedia.fr/Fichier:Coffret_Dresseur_d%27%C3%A9lite_%C3%89carlate_et_Violet_Forces_Temporelles_Vert-de-Fer.png',
        image_credit = 'Poképédia — Coffret Vert-de-Fer'
    where id = v_new_id;
  end if;
end $$;

commit;
