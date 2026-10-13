-- Add the prerelease Staff-stamped printing of N's Darmanitan (Darumacho de N).
-- The Staff print is the SVP 181 prerelease promo, also catalogued under Aventures Ensemble.
insert into public.card_print_variants (
  card_id,
  variant_key,
  variant_label,
  finish_code,
  guide_marker,
  checklist_group,
  is_master_set_target
)
select
  c.id,
  'stamp_staff_prerelease',
  'Promo brillante · Tampon Staff',
  'holo',
  'prerelease-staff',
  'stamp',
  true
from public.cards c
join public.card_sets s on s.id = c.card_set_id
where c.card_name = 'Darumacho de N'
  and (
    (s.set_code = 'SV09' and c.collector_number = 'SVP 181')
    or (s.set_code = 'svp' and c.collector_number = '181')
  )
on conflict (card_id, variant_key) do update
set variant_label = excluded.variant_label,
    finish_code = excluded.finish_code,
    guide_marker = excluded.guide_marker,
    checklist_group = excluded.checklist_group,
    is_master_set_target = excluded.is_master_set_target;
