-- Track the product-content to card relationship and backfill verified promos.
ALTER TABLE public.product_contents
  ADD COLUMN IF NOT EXISTS card_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_contents_card_id_fkey'
      AND conrelid = 'public.product_contents'::regclass
  ) THEN
    ALTER TABLE public.product_contents
      ADD CONSTRAINT product_contents_card_id_fkey
      FOREIGN KEY (card_id)
      REFERENCES public.cards(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS product_contents_card_id_idx
  ON public.product_contents (card_id)
  WHERE card_id IS NOT NULL;

COMMENT ON COLUMN public.product_contents.card_id IS
  'Direct reference to the card included in this product, when identified.';

WITH verified_links(product_name, item_name, set_code, collector_number) AS (
  VALUES
    (
      'Coffret Dresseur d’élite Méga-Évolution – Héros Transcendants',
      'Zekrom de N (MEP 031)',
      'mep',
      '031'
    ),
    (
      'Collection spéciale Phyllali VSTAR',
      'Phyllali-V – SWSH194',
      'swshp',
      'SWSH194'
    ),
    (
      'Collection spéciale Phyllali VSTAR',
      'Phyllali-VSTAR – SWSH195',
      'swshp',
      'SWSH195'
    )
)
UPDATE public.product_contents AS pc
SET card_id = c.id
FROM verified_links AS link
JOIN public.products AS p
  ON p.name = link.product_name
JOIN public.card_sets AS s
  ON s.set_code = link.set_code
JOIN public.cards AS c
  ON c.card_set_id = s.id
 AND c.collector_number = link.collector_number
WHERE pc.product_id = p.id
  AND pc.content_type = 'promo'
  AND pc.item_name = link.item_name
  AND pc.card_id IS NULL;
