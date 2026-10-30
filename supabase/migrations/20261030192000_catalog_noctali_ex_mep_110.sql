-- Add the Noctali ex MEP 110 promo and its verified card image.
-- The set row already exists in production; this is safe on a fresh database too.

insert into public.card_sets (
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
values (
  'Méga-Évolution',
  'MEP Black Star Promos',
  'mep',
  'FR',
  date '2025-09-26',
  88,
  'https://www.cardmarket.com/fr/Pokemon/Products/Singles/MEP-Black-Star-Promos/Noctali-ex-MEP110',
  'Promo Noctali-ex MEP 110 ajoutée depuis le visuel de la fiche Cardmarket fournie.',
  true
)
on conflict (set_name, language) do nothing;

insert into public.cards (
  card_set_id,
  collector_number,
  card_name,
  card_type,
  rarity_label,
  mechanic_label,
  guide_order,
  element_types,
  image_url,
  image_source_url,
  source_url
)
select
  s.id,
  '110',
  'Noctali-ex',
  'Pokémon',
  'Promo',
  'ex',
  110,
  array['Obscurité']::text[],
  'https://pokevaleur.fr/catalogue/noctali-ex-mep-110.webp',
  'https://pokevaleur.fr/catalogue/noctali-ex-mep-110.webp',
  'https://www.cardmarket.com/fr/Pokemon/Products/Singles/MEP-Black-Star-Promos/Noctali-ex-MEP110'
from public.card_sets s
where s.set_name = 'MEP Black Star Promos'
  and s.set_code = 'mep'
  and s.language = 'FR'
  and not exists (
    select 1 from public.cards c
    where c.card_set_id = s.id and c.collector_number = '110'
  );

-- If the same card row was created earlier, fill only a missing image URL.
update public.cards c
set image_url = coalesce(c.image_url, 'https://pokevaleur.fr/catalogue/noctali-ex-mep-110.webp'),
    image_source_url = coalesce(c.image_source_url, 'https://pokevaleur.fr/catalogue/noctali-ex-mep-110.webp'),
    source_url = coalesce(c.source_url, 'https://www.cardmarket.com/fr/Pokemon/Products/Singles/MEP-Black-Star-Promos/Noctali-ex-MEP110')
from public.card_sets s
where c.card_set_id = s.id
  and s.set_name = 'MEP Black Star Promos'
  and s.set_code = 'mep'
  and s.language = 'FR'
  and c.collector_number = '110'
  and c.card_name = 'Noctali-ex'
  and c.image_url is null;

insert into public.card_print_variants (
  card_id,
  variant_key,
  variant_label,
  finish_code,
  checklist_group,
  is_master_set_target
)
select
  c.id,
  'catalog_base',
  'Carte (suivi de base)',
  'unclassified',
  'main',
  true
from public.cards c
join public.card_sets s on s.id = c.card_set_id
where s.set_name = 'MEP Black Star Promos'
  and s.set_code = 'mep'
  and s.language = 'FR'
  and c.collector_number = '110'
  and c.card_name = 'Noctali-ex'
  and not exists (
    select 1 from public.card_print_variants v where v.card_id = c.id
  );
