-- Extend verified foreign print mappings to raw collection additions.
ALTER TABLE public.foreign_card_printings
  ADD COLUMN IF NOT EXISTS variant_keys text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE public.collection_cards
  ADD COLUMN IF NOT EXISTS edition_language_code text;

-- Retain the language already selected for foreign graded editions.
UPDATE public.collection_cards
SET edition_language_code = CASE upper(edition_market_code)
  WHEN 'JP' THEN 'JP'
  WHEN 'CN' THEN 'ZH-CN'
  WHEN 'TW' THEN 'ZH-TW'
  WHEN 'US' THEN 'EN'
  WHEN 'KR' THEN 'KO'
  WHEN 'FR' THEN 'FR'
  ELSE edition_language_code
END
WHERE edition_language_code IS NULL
  AND upper(coalesce(edition_market_code, '')) IN ('JP', 'CN', 'TW', 'US', 'KR', 'FR');

-- Official Japanese SV10 printing of the French catalogued card.
WITH french_card AS (
  SELECT cs.id AS set_id, c.id AS card_id
  FROM public.card_sets cs
  JOIN public.cards c ON c.card_set_id = cs.id
  WHERE cs.language = 'FR'
    AND cs.set_code = 'sv10'
    AND c.card_name = 'Tyranocif de la Team Rocket'
    AND split_part(c.collector_number, '/', 1) = '096'
  LIMIT 1
)
INSERT INTO public.foreign_card_sets (
  catalog_set_id, language_code, market_code, series_name, series_name_fr,
  set_name, set_code, source_name, source_url, validation_status
)
SELECT french_card.set_id, 'JP', 'JP', 'Scarlet & Violet', 'Écarlate et Violet',
  'ロケット団の栄光', 'SV10', 'Pokémon Card Game officiel',
  'https://www.pokemon-card.com/card-search/details.php/card/47443', 'verified'
FROM french_card
WHERE NOT EXISTS (
  SELECT 1
  FROM public.foreign_card_sets existing
  WHERE existing.language_code = 'JP'
    AND existing.market_code = 'JP'
    AND existing.set_code = 'SV10'
    AND existing.set_name = 'ロケット団の栄光'
);

WITH japanese_set AS (
  SELECT id FROM public.foreign_card_sets
  WHERE language_code = 'JP'
    AND market_code = 'JP'
    AND set_code = 'SV10'
    AND set_name = 'ロケット団の栄光'
  LIMIT 1
),
french_card AS (
  SELECT c.id AS card_id
  FROM public.card_sets cs
  JOIN public.cards c ON c.card_set_id = cs.id
  WHERE cs.language = 'FR'
    AND cs.set_code = 'sv10'
    AND c.card_name = 'Tyranocif de la Team Rocket'
    AND split_part(c.collector_number, '/', 1) = '096'
  LIMIT 1
)
INSERT INTO public.foreign_card_printings (
  foreign_set_id, catalog_card_id, collector_number, card_name, variant_keys,
  image_url, source_name, source_url, validation_status
)
SELECT japanese_set.id, french_card.card_id, '050/098', 'ロケット団のバンギラス',
  ARRAY['holo']::text[],
  'https://www.pokemon-card.com/assets/images/card_images/large/SV10/047443_P_ROKETTODANNOBANGIRASU.jpg',
  'Pokémon Card Game officiel',
  'https://www.pokemon-card.com/card-search/details.php/card/47443',
  'verified'
FROM japanese_set
CROSS JOIN french_card
WHERE NOT EXISTS (
  SELECT 1
  FROM public.foreign_card_printings existing
  WHERE existing.foreign_set_id = japanese_set.id
    AND existing.catalog_card_id = french_card.card_id
    AND existing.collector_number = '050/098'
);
