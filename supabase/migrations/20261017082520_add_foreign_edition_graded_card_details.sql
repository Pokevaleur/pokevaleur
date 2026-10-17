-- Store edition-specific references on a graded collection copy.
-- The linked catalog print remains the canonical French counterpart.
ALTER TABLE public.collection_cards
  ADD COLUMN IF NOT EXISTS edition_set_name text,
  ADD COLUMN IF NOT EXISTS edition_collector_number text,
  ADD COLUMN IF NOT EXISTS edition_card_name text;

ALTER TABLE public.collection_cards
  ADD CONSTRAINT collection_cards_foreign_edition_details_complete
  CHECK (
    (
      edition_set_name IS NULL
      AND edition_collector_number IS NULL
      AND edition_card_name IS NULL
    )
    OR (
      NULLIF(btrim(edition_set_name), '') IS NOT NULL
      AND NULLIF(btrim(edition_collector_number), '') IS NOT NULL
      AND NULLIF(btrim(edition_card_name), '') IS NOT NULL
    )
  );
