-- Link seven more officially sourced, uniquely identified promo contents.
DO $$
DECLARE invalid_link record;
BEGIN
  WITH links(product_name,item_name,set_code,collector_number) AS (
  VALUES
    ('Coffrets Necrozma Crinière du Couchant / Necrozma Ailes de l’Aurore', 'Necrozma Ailes de l’Aurore-GX', 'smp', 'SM101'),
    ('Coffrets Necrozma Crinière du Couchant / Necrozma Ailes de l’Aurore', 'Necrozma Crinière du Couchant-GX', 'smp', 'SM102'),
    ('Collection Majesté des Dragons – Ultra-Necrozma-GX', 'Ultra-Necrozma-GX', 'smp', 'SM126'),
    ('Collection Majesté des Dragons Légendes d’Unys GX', 'Reshiram-GX', 'smp', 'SM137'),
    ('Collection spéciale Majesté des Dragons – Drattak-GX', 'Drattak-GX', 'smp', 'SM139'),
    ('Collection spéciale Majesté des Dragons – Kyurem Blanc-GX', 'Kyurem Blanc-GX', 'smp', 'SM141'),
    ('Collection spéciale Célébrations – Pikachu V-UNION', 'Professeure Pimprenelle', 'swshp', 'SWSH167')
  ),
  counts AS (
    SELECT links.*,
      (SELECT count(*) FROM public.products p
       JOIN public.product_contents pc ON pc.product_id=p.id
       WHERE p.name=links.product_name AND pc.item_name=links.item_name
         AND pc.content_type='promo' AND pc.confidence='verified') content_count,
      (SELECT count(*) FROM public.card_sets s JOIN public.cards c ON c.card_set_id=s.id
       WHERE s.set_code=links.set_code AND c.collector_number=links.collector_number
         AND lower(regexp_replace(c.card_name,'[^[:alnum:]]','','g')) =
             lower(regexp_replace(links.item_name,'[^[:alnum:]]','','g'))) card_count
    FROM links
  )
  SELECT * INTO invalid_link FROM counts
  WHERE content_count <> 1 OR card_count <> 1 LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Promo link is not unique: product %, item %, cards %, contents %',
      invalid_link.product_name, invalid_link.item_name,
      invalid_link.card_count, invalid_link.content_count;
  END IF;
END
$$;

WITH verified_links(product_name,item_name,set_code,collector_number) AS (
  VALUES
    ('Coffrets Necrozma Crinière du Couchant / Necrozma Ailes de l’Aurore', 'Necrozma Ailes de l’Aurore-GX', 'smp', 'SM101'),
    ('Coffrets Necrozma Crinière du Couchant / Necrozma Ailes de l’Aurore', 'Necrozma Crinière du Couchant-GX', 'smp', 'SM102'),
    ('Collection Majesté des Dragons – Ultra-Necrozma-GX', 'Ultra-Necrozma-GX', 'smp', 'SM126'),
    ('Collection Majesté des Dragons Légendes d’Unys GX', 'Reshiram-GX', 'smp', 'SM137'),
    ('Collection spéciale Majesté des Dragons – Drattak-GX', 'Drattak-GX', 'smp', 'SM139'),
    ('Collection spéciale Majesté des Dragons – Kyurem Blanc-GX', 'Kyurem Blanc-GX', 'smp', 'SM141'),
    ('Collection spéciale Célébrations – Pikachu V-UNION', 'Professeure Pimprenelle', 'swshp', 'SWSH167')
)
UPDATE public.product_contents AS pc
SET card_id=c.id
FROM verified_links link
JOIN public.products p ON p.name=link.product_name
JOIN public.card_sets s ON s.set_code=link.set_code
JOIN public.cards c ON c.card_set_id=s.id AND c.collector_number=link.collector_number
WHERE pc.product_id=p.id AND pc.content_type='promo'
  AND pc.confidence='verified' AND pc.item_name=link.item_name AND pc.card_id IS NULL;
