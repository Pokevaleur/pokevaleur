-- Catalog the French McDonald's Match Battle / Combat Express boosters for 2022 and 2023.
-- Add possible-card links for each French 15-card promo set.
-- 2022: https://www.pokepedia.fr/Combat_Express_(2022)
-- French operation, September 2022: https://www.mcdo-strasbourg.fr/les-pokemon-sont-de-retour-dans-votre-happy-meal/
-- 2023: https://www.pokepedia.fr/Combat_Express_(2023)
-- French operation, December 2023: https://www.mcdo-strasbourg.fr/les-pokemon-sont-de-retour-dans-votre-happy-meal-2/
-- Keep both entries private and their images as placeholders pending authorized exact pack artwork.
DO $$
DECLARE
  v_operations jsonb := '[
    {"set_code":"2022swsh","set_name":"Collection McDonald''s 2022","old_date":"2022-08-03","release_date":"2022-09-27","product_name":"Booster promotionnel McDonald’s Pokémon 2022 (Combat Express)","series":"McDonald’s 2022 (Combat Express)","period":"2022-09"},
    {"set_code":"2023sv","set_name":"Collection McDonald''s 2023","old_date":"2023-08-01","release_date":"2023-12-06","product_name":"Booster promotionnel McDonald’s Pokémon 2023 (Combat Express)","series":"McDonald’s 2023 (Combat Express)","period":"2023-12"}
  ]';
  v_cards jsonb := '[
    {"set_code":"2022swsh","number":"1","name":"Coxy"},
    {"set_code":"2022swsh","number":"2","name":"Brindibou"},
    {"set_code":"2022swsh","number":"3","name":"Tournicoton"},
    {"set_code":"2022swsh","number":"4","name":"Caninos"},
    {"set_code":"2022swsh","number":"5","name":"Victini"},
    {"set_code":"2022swsh","number":"6","name":"Lokhlass"},
    {"set_code":"2022swsh","number":"7","name":"Pikachu"},
    {"set_code":"2022swsh","number":"8","name":"Loupio"},
    {"set_code":"2022swsh","number":"9","name":"Lainergie"},
    {"set_code":"2022swsh","number":"10","name":"Anchwatt"},
    {"set_code":"2022swsh","number":"11","name":"Bombydou"},
    {"set_code":"2022swsh","number":"12","name":"Chelours"},
    {"set_code":"2022swsh","number":"13","name":"Pandarbare"},
    {"set_code":"2022swsh","number":"14","name":"Draïeul"},
    {"set_code":"2022swsh","number":"15","name":"Queulorior"},
    {"set_code":"2023sv","number":"1","name":"Poussacha"},
    {"set_code":"2023sv","number":"2","name":"Chochodile"},
    {"set_code":"2023sv","number":"3","name":"Coiffeton"},
    {"set_code":"2023sv","number":"4","name":"Piétacé"},
    {"set_code":"2023sv","number":"5","name":"Balbalèze"},
    {"set_code":"2023sv","number":"6","name":"Pikachu"},
    {"set_code":"2023sv","number":"7","name":"Pohm"},
    {"set_code":"2023sv","number":"8","name":"Fulgulairo"},
    {"set_code":"2023sv","number":"9","name":"Flotillon"},
    {"set_code":"2023sv","number":"10","name":"Dunaconda"},
    {"set_code":"2023sv","number":"11","name":"Craparoi"},
    {"set_code":"2023sv","number":"12","name":"Leuphorie"},
    {"set_code":"2023sv","number":"13","name":"Compagnol"},
    {"set_code":"2023sv","number":"14","name":"Motorizard"},
    {"set_code":"2023sv","number":"15","name":"Kirlia"}
  ]';
  v_set_count integer;
  v_card_count integer;
  v_product_count integer;
  v_link_count integer;
BEGIN
  SELECT count(*) INTO v_set_count
  FROM jsonb_to_recordset(v_operations) AS op(
    set_code text,set_name text,old_date date,release_date date,
    product_name text,series text,period text
  )
  JOIN public.card_sets cs
    ON cs.set_code=op.set_code
   AND cs.set_name=op.set_name
   AND cs.language='FR';
  IF v_set_count <> 2 THEN
    RAISE EXCEPTION 'Expected both French Match Battle sets; found %', v_set_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(v_operations) AS op(
      set_code text,set_name text,old_date date,release_date date,
      product_name text,series text,period text
    )
    JOIN public.card_sets cs
      ON cs.set_code=op.set_code
     AND cs.set_name=op.set_name
     AND cs.language='FR'
    WHERE cs.release_date IS DISTINCT FROM op.old_date
      AND cs.release_date IS DISTINCT FROM op.release_date
  ) THEN
    RAISE EXCEPTION 'A French Match Battle set has an unexpected release date';
  END IF;

  UPDATE public.card_sets cs
  SET release_date=op.release_date
  FROM jsonb_to_recordset(v_operations) AS op(
    set_code text,set_name text,old_date date,release_date date,
    product_name text,series text,period text
  )
  WHERE cs.set_code=op.set_code
    AND cs.set_name=op.set_name
    AND cs.language='FR';

  SELECT count(*) INTO v_card_count
  FROM jsonb_to_recordset(v_cards) AS expected(set_code text,number text,name text)
  JOIN public.card_sets cs
    ON cs.set_code=expected.set_code AND cs.language='FR'
  JOIN public.cards c
    ON c.card_set_id=cs.id
   AND c.collector_number=expected.number
   AND c.card_name=expected.name;
  IF v_card_count <> 30 THEN
    RAISE EXCEPTION 'Expected 30 exact French card matches across the two sets; found %', v_card_count;
  END IF;

  SELECT count(*) INTO v_product_count
  FROM jsonb_to_recordset(v_operations) AS op(
    set_code text,set_name text,old_date date,release_date date,
    product_name text,series text,period text
  )
  JOIN public.products p
    ON p.name=op.product_name
   AND p.category='sealed'
   AND p.product_type='Booster promotionnel'
   AND p.language='FR';
  IF v_product_count > 2 THEN
    RAISE EXCEPTION 'Found duplicate French McDonald''s 2022/2023 products: %', v_product_count;
  END IF;

  INSERT INTO public.products
    (name,category,series,release_date,is_public,image_usage_status,language,
     product_type,release_year,release_period)
  SELECT op.product_name,'sealed',op.series,op.release_date,false,'placeholder',
         'FR','Booster promotionnel',EXTRACT(YEAR FROM op.release_date)::integer,op.period
  FROM jsonb_to_recordset(v_operations) AS op(
    set_code text,set_name text,old_date date,release_date date,
    product_name text,series text,period text
  )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.name=op.product_name
      AND p.category='sealed'
      AND p.product_type='Booster promotionnel'
      AND p.language='FR'
  );

  INSERT INTO public.product_contents
    (product_id,content_type,item_name,quantity,source_url,source_label,confidence,content_role)
  SELECT p.id,'promo','4 cartes aléatoires (dont 1 holographique)',4,
         CASE op.set_code
           WHEN '2022swsh' THEN 'https://www.pokepedia.fr/Combat_Express_(2022)'
           ELSE 'https://www.pokepedia.fr/Combat_Express_(2023)'
         END,
         'Poképédia — composition du booster Combat Express',
         'verified','guaranteed'
  FROM jsonb_to_recordset(v_operations) AS op(
    set_code text,set_name text,old_date date,release_date date,
    product_name text,series text,period text
  )
  JOIN public.products p
    ON p.name=op.product_name
   AND p.category='sealed'
   AND p.product_type='Booster promotionnel'
   AND p.language='FR'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.product_contents existing
    WHERE existing.product_id=p.id
      AND existing.content_type='promo'
      AND existing.content_role='guaranteed'
      AND existing.item_name='4 cartes aléatoires (dont 1 holographique)'
      AND existing.quantity=4
  );

  INSERT INTO public.product_contents
    (product_id,content_type,item_name,quantity,source_url,source_label,
     confidence,card_id,content_role)
  SELECT p.id,'promo',expected.name,1,
         CASE expected.set_code
           WHEN '2022swsh' THEN 'https://www.pokepedia.fr/Combat_Express_(2022)'
           ELSE 'https://www.pokepedia.fr/Combat_Express_(2023)'
         END,
         'Poképédia — Combat Express, carte possible',
         'verified',c.id,'possible'
  FROM jsonb_to_recordset(v_cards) AS expected(set_code text,number text,name text)
  JOIN public.card_sets cs
    ON cs.set_code=expected.set_code AND cs.language='FR'
  JOIN public.cards c
    ON c.card_set_id=cs.id
   AND c.collector_number=expected.number
   AND c.card_name=expected.name
  JOIN jsonb_to_recordset(v_operations) AS op(
    set_code text,set_name text,old_date date,release_date date,
    product_name text,series text,period text
  ) ON op.set_code=expected.set_code
  JOIN public.products p
    ON p.name=op.product_name
   AND p.category='sealed'
   AND p.product_type='Booster promotionnel'
   AND p.language='FR'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.product_contents existing
    WHERE existing.product_id=p.id
      AND existing.content_type='promo'
      AND existing.content_role='possible'
      AND existing.card_id=c.id
  );

  SELECT count(*) INTO v_link_count
  FROM jsonb_to_recordset(v_operations) AS op(
    set_code text,set_name text,old_date date,release_date date,
    product_name text,series text,period text
  )
  JOIN public.products p
    ON p.name=op.product_name
   AND p.category='sealed'
   AND p.product_type='Booster promotionnel'
   AND p.language='FR'
  JOIN public.product_contents pc
    ON pc.product_id=p.id
   AND pc.content_type='promo'
   AND pc.content_role='possible'
  JOIN public.card_sets cs
    ON cs.set_code=op.set_code AND cs.language='FR'
  JOIN public.cards c
    ON c.id=pc.card_id AND c.card_set_id=cs.id;
  IF v_link_count <> 30 THEN
    RAISE EXCEPTION 'Expected 30 possible card links across both boosters; found %', v_link_count;
  END IF;
END $$;
