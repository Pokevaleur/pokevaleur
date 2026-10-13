-- Restore TCGdex's zero-padded image IDs for energy cards in sets
-- where the canonical asset path uses the full collector number.
-- The MEE and SVE promo sets intentionally use unpadded image IDs and are excluded.
UPDATE public.cards AS c
SET image_url = regexp_replace(
  c.image_url,
  '/[0-9]+/low\\.webp$',
  '/' || c.collector_number || '/low.webp'
)
FROM public.card_sets AS s
WHERE s.id = c.card_set_id
  AND (s.set_code, c.collector_number) IN (
    ('me03', '086'),
    ('me03', '087'),
    ('me03', '088'),
    ('me04', '084'),
    ('me04', '085'),
    ('me04', '086'),
    ('me05', '083'),
    ('me05', '084'),
    ('sv10.5b', '086'),
    ('sv10.5w', '086')
  )
  AND c.image_url IS DISTINCT FROM regexp_replace(
    c.image_url,
    '/[0-9]+/low\\.webp$',
    '/' || c.collector_number || '/low.webp'
  );
