-- Personal classification only. NULL preserves the existing automatic classification.
-- No backfill: existing names, product links and catalog data remain untouched.
ALTER TABLE public.collection_items
  ADD COLUMN IF NOT EXISTS sealed_format_override text;

ALTER TABLE public.collection_items
  ADD CONSTRAINT collection_items_sealed_format_override_valid
  CHECK (sealed_format_override IS NULL OR sealed_format_override IN (
    'halfDisplay', 'etb', 'miniTin', 'valisette', 'prereleaseKit',
    'prereleaseKitDisplay', 'bundle', 'display', 'pokebox', 'case',
    'booster', 'coffret', 'other'
  ));

COMMENT ON COLUMN public.collection_items.sealed_format_override IS
  'Personal sealed format assignment; NULL uses automatic classification. Does not modify products.';
