-- Complete the French SVE energy checklist: 24 cards, 64 print variants.
-- Existing catalog_base IDs are retained so collection ownership keeps its references.
update public.card_print_variants v
set variant_label = 'Normale',
    finish_code = 'standard'
from public.cards c
join public.card_sets s on s.id = c.card_set_id
where v.card_id = c.id
  and s.set_code = 'sve'
  and c.card_type = 'Énergie'
  and v.variant_key = 'catalog_base';

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
  variant.variant_key,
  variant.variant_label,
  variant.finish_code,
  'main',
  true
from public.cards c
join public.card_sets s on s.id = c.card_set_id
cross join lateral (
  values
    ('reverse', 'Reverse', 'reverse'),
    ('parallel_holo', 'Holo parallèle', 'holo'),
    ('holo_cosmos', 'Holo cosmos', 'holo')
) as variant(variant_key, variant_label, finish_code)
where s.set_code = 'sve'
  and c.card_type = 'Énergie'
  and (
    variant.variant_key = 'reverse'
    or c.collector_number between '001' and '008'
  )
on conflict (card_id, variant_key) do nothing;
