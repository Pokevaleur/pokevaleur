-- Add the French McDonald's 2021 promotional booster to the sealed catalog.
-- Correct France-specific set metadata: the current date is the North American start date,
-- and card 12 is Ouisticram (not Chimpenfeu).
-- French promotion dates, 25-card list, and card collation:
-- https://www.pokepedia.fr/Collection_McDonald%27s_2021
-- French promotion notice:
-- https://actualitesjeuxvideo.fr/fetez-les-25-ans-de-pokemon-chez-mcdonalds/
-- The public catalog entry remains private until an exact, authorized packaging image is available.
DO $$
DECLARE
  v_product_count integer;
  v_set_count integer;
  v_card_count integer;
  v_link_count integer;
  v_set_id uuid;
  v_product_id uuid;
BEGIN
  SELECT count(*) INTO v_set_count
  FROM public.card_sets cs
  WHERE cs.set_code = '2021swsh'
    AND cs.set_name = 'Collection McDonald''s 2021'
    AND cs.language = 'FR';
  IF v_set_count <> 1 THEN
    RAISE EXCEPTION 'Expected one French McDonald''s 2021 set; found %', v_set_count;
  END IF;

  SELECT cs.id INTO v_set_id
  FROM public.card_sets cs
  WHERE cs.set_code = '2021swsh'
    AND cs.set_name = 'Collection McDonald''s 2021'
    AND cs.language = 'FR';

  UPDATE public.card_sets
  SET release_date = DATE '2021-04-14'
  WHERE id = v_set_id
    AND release_date = DATE '2021-02-09';

  SELECT count(*) INTO v_card_count
  FROM public.cards c
  WHERE c.card_set_id = v_set_id
    AND c.collector_number = '12'
    AND c.card_name IN ('Chimpenfeu', 'Ouisticram');
  IF v_card_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one French card 12 named Chimpenfeu or Ouisticram; found %', v_card_count;
  END IF;

  UPDATE public.cards
  SET card_name = 'Ouisticram'
  WHERE card_set_id = v_set_id
    AND collector_number = '12'
    AND card_name = 'Chimpenfeu';

  IF NOT EXISTS (
    SELECT 1 FROM public.cards c
    WHERE c.card_set_id = v_set_id
      AND c.collector_number = '12'
      AND c.card_name = 'Ouisticram'
  ) THEN
    RAISE EXCEPTION 'French card 12 was not corrected to Ouisticram';
  END IF;

  SELECT count(*) INTO v_product_count
  FROM public.products p
  WHERE p.name = 'Booster promotionnel McDonald’s Pokémon 2021 (25e anniversaire)'
    AND p.category = 'sealed'
    AND p.product_type = 'Booster promotionnel'
    AND p.language = 'FR';
  IF v_product_count > 1 THEN
    RAISE EXCEPTION 'Found duplicate French McDonald''s 2021 booster products: %', v_product_count;
  END IF;

  IF v_product_count = 0 THEN
    INSERT INTO public.products
      (name, category, series, release_date, is_public, image_usage_status,
       language, product_type, release_year, release_period)
    VALUES
      ('Booster promotionnel McDonald’s Pokémon 2021 (25e anniversaire)',
       'sealed', 'McDonald’s 2021 (25e anniversaire)', DATE '2021-04-14',
       false, 'placeholder', 'FR', 'Booster promotionnel', 2021, '2021-04');
  END IF;

  SELECT p.id INTO v_product_id
  FROM public.products p
  WHERE p.name = 'Booster promotionnel McDonald’s Pokémon 2021 (25e anniversaire)'
    AND p.category = 'sealed'
    AND p.product_type = 'Booster promotionnel'
    AND p.language = 'FR';

  IF v_product_id IS NULL THEN
    RAISE EXCEPTION 'French McDonald''s 2021 booster product could not be resolved';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.product_contents pc
    WHERE pc.product_id = v_product_id
      AND pc.content_type = 'promo'
      AND pc.item_name = '4 cartes aléatoires (dont 1 reverse holographique)'
      AND pc.quantity = 4
      AND pc.content_role = 'guaranteed'
  ) THEN
    INSERT INTO public.product_contents
      (product_id, content_type, item_name, quantity, source_url, source_label,
       confidence, content_role)
    VALUES
      (v_product_id, 'promo',
       '4 cartes aléatoires (dont 1 reverse holographique)', 4,
       'https://www.pokepedia.fr/Collection_McDonald%27s_2021',
       'Poképédia — composition des boosters McDonald’s 2021',
       'verified', 'guaranteed');
  END IF;

  WITH expected(collector_number, card_name) AS (
    VALUES
      ('1','Bulbizarre'), ('2','Germignon'), ('3','Arcko'),
      ('4','Tortipouss'), ('5','Vipélierre'), ('6','Marisson'),
      ('7','Brindibou'), ('8','Ouistempo'), ('9','Salamèche'),
      ('10','Héricendre'), ('11','Poussifeu'), ('12','Ouisticram'),
      ('13','Gruikui'), ('14','Feunnec'), ('15','Flamiaou'),
      ('16','Flambino'), ('17','Carapuce'), ('18','Kaiminus'),
      ('19','Gobou'), ('20','Tiplouf'), ('21','Moustillon'),
      ('22','Grenousse'), ('23','Otaquin'), ('24','Larméléon'),
      ('25','Pikachu')
  )
  SELECT count(*) INTO v_card_count
  FROM expected e
  JOIN public.cards c
    ON c.card_set_id = v_set_id
   AND c.collector_number = e.collector_number
   AND c.card_name = e.card_name;
  IF v_card_count <> 25 THEN
    RAISE EXCEPTION 'Expected 25 exact French card matches; found %', v_card_count;
  END IF;

  WITH expected(collector_number, card_name) AS (
    VALUES
      ('1','Bulbizarre'), ('2','Germignon'), ('3','Arcko'),
      ('4','Tortipouss'), ('5','Vipélierre'), ('6','Marisson'),
      ('7','Brindibou'), ('8','Ouistempo'), ('9','Salamèche'),
      ('10','Héricendre'), ('11','Poussifeu'), ('12','Ouisticram'),
      ('13','Gruikui'), ('14','Feunnec'), ('15','Flamiaou'),
      ('16','Flambino'), ('17','Carapuce'), ('18','Kaiminus'),
      ('19','Gobou'), ('20','Tiplouf'), ('21','Moustillon'),
      ('22','Grenousse'), ('23','Otaquin'), ('24','Larméléon'),
      ('25','Pikachu')
  )
  INSERT INTO public.product_contents
    (product_id, content_type, item_name, quantity, source_url, source_label,
     confidence, card_id, content_role)
  SELECT v_product_id, 'promo', e.card_name, 1,
    'https://www.pokepedia.fr/Collection_McDonald%27s_2021',
    'Poképédia — Collection McDonald’s 2021, carte possible',
    'verified', c.id, 'possible'
  FROM expected e
  JOIN public.cards c
    ON c.card_set_id = v_set_id
   AND c.collector_number = e.collector_number
   AND c.card_name = e.card_name
  WHERE NOT EXISTS (
    SELECT 1 FROM public.product_contents existing
    WHERE existing.product_id = v_product_id
      AND existing.content_type = 'promo'
      AND existing.content_role = 'possible'
      AND existing.card_id = c.id
  );

  SELECT count(*) INTO v_link_count
  FROM public.product_contents pc
  WHERE pc.product_id = v_product_id
    AND pc.content_type = 'promo'
    AND pc.content_role = 'possible'
    AND pc.card_id IS NOT NULL;
  IF v_link_count <> 25 THEN
    RAISE EXCEPTION 'Expected 25 possible French card links after insert; found %', v_link_count;
  END IF;
END $$;
