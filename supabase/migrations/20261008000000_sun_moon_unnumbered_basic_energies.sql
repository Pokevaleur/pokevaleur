-- Allow truly unnumbered cards to be represented without invented collector numbers.
ALTER TABLE public.cards
  ALTER COLUMN collector_number DROP NOT NULL;

-- One block-level checklist group for the nine French basic Energies introduced in 2019.
INSERT INTO public.card_sets (
  series_name,
  set_name,
  set_code,
  language,
  release_date,
  advertised_card_count,
  checklist_source_url,
  checklist_scope_note,
  is_public
)
VALUES (
  'Soleil et Lune',
  'Énergies de base Soleil et Lune (2019)',
  NULL,
  'FR',
  NULL,
  9,
  'https://www.pokepedia.fr/Carte_%C3%89nergie',
  'Groupe récapitulatif de neuf Énergies de base non numérotées, disponibles à partir de Duo de Choc jusqu’à la fin de Soleil et Lune. Aucune rareté indiquée. Les images et finitions restent à documenter.',
  true
)
ON CONFLICT (set_name, language) DO NOTHING;

WITH target_set AS (
  SELECT id
  FROM public.card_sets
  WHERE set_name = 'Énergies de base Soleil et Lune (2019)'
    AND language = 'FR'
),
energy_cards(card_name, element_type, guide_order) AS (
  VALUES
    ('Énergie Plante', 'Plante', 1),
    ('Énergie Feu', 'Feu', 2),
    ('Énergie Eau', 'Eau', 3),
    ('Énergie Électrique', 'Électrique', 4),
    ('Énergie Psy', 'Psy', 5),
    ('Énergie Combat', 'Combat', 6),
    ('Énergie Obscurité', 'Obscurité', 7),
    ('Énergie Métal', 'Métal', 8),
    ('Énergie Fée', 'Fée', 9)
)
INSERT INTO public.cards (
  card_set_id,
  collector_number,
  card_name,
  card_type,
  rarity_label,
  element_types,
  guide_order,
  image_url,
  image_source_url,
  source_url
)
SELECT
  target_set.id,
  NULL,
  energy_cards.card_name,
  'Énergie',
  NULL,
  ARRAY[energy_cards.element_type]::text[],
  energy_cards.guide_order,
  NULL,
  NULL,
  'https://www.pokepedia.fr/Carte_%C3%89nergie'
FROM target_set
CROSS JOIN energy_cards
WHERE NOT EXISTS (
  SELECT 1
  FROM public.cards existing
  WHERE existing.card_set_id = target_set.id
    AND existing.card_name = energy_cards.card_name
);

-- A generic tracking row leaves the finish unclassified until print evidence is collected.
INSERT INTO public.card_print_variants (
  card_id,
  variant_key,
  variant_label,
  finish_code,
  checklist_group,
  is_master_set_target
)
SELECT
  card.id,
  'catalog_base',
  'Carte (suivi de base)',
  'unclassified',
  'main',
  true
FROM public.cards card
JOIN public.card_sets card_set ON card_set.id = card.card_set_id
WHERE card_set.set_name = 'Énergies de base Soleil et Lune (2019)'
  AND card_set.language = 'FR'
  AND NOT EXISTS (
    SELECT 1
    FROM public.card_print_variants existing
    WHERE existing.card_id = card.id
      AND existing.variant_key = 'catalog_base'
  );
