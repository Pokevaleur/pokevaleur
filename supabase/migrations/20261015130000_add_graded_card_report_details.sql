-- Add graded-card report details without rewriting existing collection records.
ALTER TABLE public.collection_cards
  ADD COLUMN IF NOT EXISTS grading_date date,
  ADD COLUMN IF NOT EXISTS graded_language text,
  ADD COLUMN IF NOT EXISTS grading_report_url text,
  ADD COLUMN IF NOT EXISTS grading_front_notes text,
  ADD COLUMN IF NOT EXISTS grading_back_notes text;
