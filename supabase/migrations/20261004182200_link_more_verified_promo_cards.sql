-- Link additional verified promo contents to their unique checklist cards.
DO $$
DECLARE
  invalid_link record;
BEGIN
  WITH links(product_name, item_name, set_code, collector_number) AS (
    VALUES
      ('Coffret Dresseur d’élite Légendes Brillantes', 'Ho-Oh Brillant', 'smp', 'SM70'),
      ('Coffret Porygon-Z-GX', 'Porygon-Z-GX', 'smp', 'SM216'),
      ('Coffret Sucreine-GX', 'Sucreine-GX', 'smp', 'SM56'),
      ('Collection Légendes de Johto GX', 'Raikou-GX', 'smp', 'SM121'),
      ('Collection Majesté des Dragons Légendes d’Unys GX', 'Zekrom-GX', 'smp', 'SM138'),
      ('Collection Premium Forces de la Nature-GX', 'Fulguris-GX', 'smp', 'SM133'),
      ('Collection Premium Forces de la Nature-GX', 'Boréas-GX', 'smp', 'SM134'),
      ('Collection Super-Premium Légendes Brillantes – Ho-Oh', 'Lugia Brillant', 'smp', 'SM82'),
      ('Coffret Combat VMAX & VSTAR Deoxys', 'Deoxys-V', 'swshp', 'SWSH266'),
      ('Coffret Polthégeist-V', 'Polthégeist-V', 'swshp', 'SWSH021'),
      ('Collection Célébrations – Nymphali Obscur-V', 'Nymphali Obscur-V', 'swshp', 'SWSH134'),
      ('Valisette Célébrations', 'Salarsen Lumineux', 'swshp', 'SWSH137'),
      ('Valisette Célébrations', 'Trioxhydre C', 'swshp', 'SWSH138'),
      ('Collection Premium Méga-Ptéra-EX', 'Ptéra-EX', 'xyp', 'XY97')
  ),
  link_counts AS (
    SELECT
      links.*,
      (SELECT count(*)
       FROM public.products p
       JOIN public.product_contents pc ON pc.product_id = p.id
       WHERE p.name = links.product_name
         AND pc.item_name = links.item_name
         AND pc.content_type = 'promo'
         AND pc.confidence = 'verified') AS content_count,
      (SELECT count(*)
       FROM public.card_sets s
       JOIN public.cards c ON c.card_set_id = s.id
       WHERE s.set_code = links.set_code
         AND c.collector_number = links.collector_number) AS card_count
    FROM links
  )
  SELECT * INTO invalid_link
  FROM link_counts
  WHERE content_count <> 1 OR card_count <> 1
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Promo link is not unique: product %, item %, cards %, contents %',
      invalid_link.product_name, invalid_link.item_name,
      invalid_link.card_count, invalid_link.content_count;
  END IF;
END
$$;

WITH verified_links(product_name, item_name, set_code, collector_number) AS (
  VALUES
    ('Coffret Dresseur d’élite Légendes Brillantes', 'Ho-Oh Brillant', 'smp', 'SM70'),
    ('Coffret Porygon-Z-GX', 'Porygon-Z-GX', 'smp', 'SM216'),
    ('Coffret Sucreine-GX', 'Sucreine-GX', 'smp', 'SM56'),
    ('Collection Légendes de Johto GX', 'Raikou-GX', 'smp', 'SM121'),
    ('Collection Majesté des Dragons Légendes d’Unys GX', 'Zekrom-GX', 'smp', 'SM138'),
    ('Collection Premium Forces de la Nature-GX', 'Fulguris-GX', 'smp', 'SM133'),
    ('Collection Premium Forces de la Nature-GX', 'Boréas-GX', 'smp', 'SM134'),
    ('Collection Super-Premium Légendes Brillantes – Ho-Oh', 'Lugia Brillant', 'smp', 'SM82'),
    ('Coffret Combat VMAX & VSTAR Deoxys', 'Deoxys-V', 'swshp', 'SWSH266'),
    ('Coffret Polthégeist-V', 'Polthégeist-V', 'swshp', 'SWSH021'),
    ('Collection Célébrations – Nymphali Obscur-V', 'Nymphali Obscur-V', 'swshp', 'SWSH134'),
    ('Valisette Célébrations', 'Salarsen Lumineux', 'swshp', 'SWSH137'),
    ('Valisette Célébrations', 'Trioxhydre C', 'swshp', 'SWSH138'),
    ('Collection Premium Méga-Ptéra-EX', 'Ptéra-EX', 'xyp', 'XY97')
)
UPDATE public.product_contents AS pc
SET card_id = c.id
FROM verified_links AS link
JOIN public.products AS p ON p.name = link.product_name
JOIN public.card_sets AS s ON s.set_code = link.set_code
JOIN public.cards AS c
  ON c.card_set_id = s.id
 AND c.collector_number = link.collector_number
WHERE pc.product_id = p.id
  AND pc.content_type = 'promo'
  AND pc.confidence = 'verified'
  AND pc.item_name = link.item_name
  AND pc.card_id IS NULL;
