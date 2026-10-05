-- Link all fifteen possible French McDonald's 2024 promo cards to the sealed booster.
-- French operation dates and the complete 15-card list: Margxt.
-- Pack collation (4 random cards, at least one holo): Margxt and PokeBeach.
-- Keep the existing guaranteed 4-card row; these direct links describe possible cards.
-- Reference pages:
-- https://www.margxt.fr/les-cartes-pokemon-mcdonalds-2024-seront-disponibles-du-4-decembre-au-21-janvier/
-- https://www.pokebeach.com/2024/12/all-mcdonalds-2024-pokemon-cards-revealed-but-still-no-sign-of-u-s-release
DO $$
DECLARE
  v_products integer;
  v_sets integer;
  v_targets integer;
  v_distinct_targets integer;
  v_pack_rows integer;
  v_linked integer;
BEGIN
  SELECT count(*) INTO v_products
  FROM public.products p
  WHERE p.name = 'Booster promotionnel McDonald’s Pokémon 2024 (M24FR)'
    AND p.category = 'sealed'
    AND p.product_type = 'Booster promotionnel'
    AND p.language = 'FR';
  IF v_products <> 1 THEN
    RAISE EXCEPTION 'Expected one French McDonald''s 2024 booster product; found %', v_products;
  END IF;

  SELECT count(*) INTO v_sets
  FROM public.card_sets cs
  WHERE cs.set_code = '2024sv'
    AND cs.set_name = 'Collection McDonald''s 2024'
    AND cs.language = 'FR';
  IF v_sets <> 1 THEN
    RAISE EXCEPTION 'Expected one French McDonald''s 2024 card set; found %', v_sets;
  END IF;

  SELECT count(*) INTO v_pack_rows
  FROM public.product_contents pc
  JOIN public.products p ON p.id = pc.product_id
  WHERE p.name = 'Booster promotionnel McDonald’s Pokémon 2024 (M24FR)'
    AND pc.content_type = 'promo'
    AND pc.item_name = 'Cartes promotionnelles aléatoires (au moins une brillante)'
    AND pc.quantity = 4
    AND pc.content_role = 'guaranteed'
    AND pc.confidence = 'verified';
  IF v_pack_rows <> 1 THEN
    RAISE EXCEPTION 'Expected one verified four-card booster-content row; found %', v_pack_rows;
  END IF;

  WITH expected(collector_number, card_name) AS (
    VALUES
      ('1','Dracaufeu'), ('2','Pikachu'), ('3','Miraidon'), ('4','Rondoudou'),
      ('5','Bibichut'), ('6','Lanssorien'), ('7','Maraiste'), ('8','Koraidon'),
      ('9','Noctali'), ('10','Trioxhydre'), ('11','Rugit-Lune'),
      ('12','Dracolosse'), ('13','Évoli'), ('14','Rayquaza'), ('15','Draïeul')
  )
  SELECT count(*), count(DISTINCT c.id)
  INTO v_targets, v_distinct_targets
  FROM expected e
  JOIN public.card_sets cs
    ON cs.set_code = '2024sv'
   AND cs.set_name = 'Collection McDonald''s 2024'
   AND cs.language = 'FR'
  JOIN public.cards c
    ON c.card_set_id = cs.id
   AND c.collector_number = e.collector_number
   AND c.card_name = e.card_name;
  IF v_targets <> 15 OR v_distinct_targets <> 15 THEN
    RAISE EXCEPTION 'Expected 15 unique French card matches; found % rows and % unique cards',
      v_targets, v_distinct_targets;
  END IF;

  WITH expected(collector_number, card_name) AS (
    VALUES
      ('1','Dracaufeu'), ('2','Pikachu'), ('3','Miraidon'), ('4','Rondoudou'),
      ('5','Bibichut'), ('6','Lanssorien'), ('7','Maraiste'), ('8','Koraidon'),
      ('9','Noctali'), ('10','Trioxhydre'), ('11','Rugit-Lune'),
      ('12','Dracolosse'), ('13','Évoli'), ('14','Rayquaza'), ('15','Draïeul')
  )
  INSERT INTO public.product_contents
    (product_id, content_type, item_name, quantity, source_url, source_label,
     confidence, card_id, content_role)
  SELECT p.id, 'promo', e.card_name, 1,
    'https://www.margxt.fr/les-cartes-pokemon-mcdonalds-2024-seront-disponibles-du-4-decembre-au-21-janvier/',
    'Margxt — liste française McDonald’s 2024, carte possible',
    'verified', c.id, 'possible'
  FROM public.products p
  JOIN public.card_sets cs
    ON cs.set_code = '2024sv'
   AND cs.set_name = 'Collection McDonald''s 2024'
   AND cs.language = 'FR'
  JOIN expected e ON true
  JOIN public.cards c
    ON c.card_set_id = cs.id
   AND c.collector_number = e.collector_number
   AND c.card_name = e.card_name
  WHERE p.name = 'Booster promotionnel McDonald’s Pokémon 2024 (M24FR)'
    AND p.category = 'sealed'
    AND p.product_type = 'Booster promotionnel'
    AND p.language = 'FR'
    AND NOT EXISTS (
      SELECT 1
      FROM public.product_contents existing
      WHERE existing.product_id = p.id
        AND existing.content_type = 'promo'
        AND existing.content_role = 'possible'
        AND existing.card_id = c.id
    );

  SELECT count(*) INTO v_linked
  FROM public.product_contents pc
  JOIN public.products p ON p.id = pc.product_id
  JOIN public.card_sets cs ON cs.set_code = '2024sv' AND cs.language = 'FR'
  JOIN public.cards c ON c.id = pc.card_id AND c.card_set_id = cs.id
  WHERE p.name = 'Booster promotionnel McDonald’s Pokémon 2024 (M24FR)'
    AND pc.content_type = 'promo'
    AND pc.content_role = 'possible';
  IF v_linked <> 15 THEN
    RAISE EXCEPTION 'Expected 15 possible card links after insert; found %', v_linked;
  END IF;
END $$;
