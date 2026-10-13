-- Use the official English TCGdex scan for these energy cards.
-- Their French catalogue entries have no image that renders on the CDN,
-- while the corresponding English TCGdex card pages provide the scans.
UPDATE public.cards AS c
SET image_url = replace(c.image_url, 'assets.tcgdex.net/fr/', 'assets.tcgdex.net/en/')
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
  AND c.image_url LIKE 'https://assets.tcgdex.net/fr/%'
  AND c.image_url IS DISTINCT FROM replace(
    c.image_url,
    'assets.tcgdex.net/fr/',
    'assets.tcgdex.net/en/'
  );
