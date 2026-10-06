-- Enable basic collection tracking for every French card already in the catalog.
-- Cards without a verified print-variant inventory receive one neutral entry.
-- This does not infer holo/reverse/stamp finishes; the checklist note says so.
begin;

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
where s.language = 'FR'
  and not exists (
    select 1
    from public.card_print_variants v
    where v.card_id = c.id
  )
on conflict (card_id, variant_key) do nothing;

update public.card_sets s
set is_public = true,
    checklist_scope_note = case
      when exists (
        select 1
        from public.card_print_variants v
        join public.cards c on c.id = v.card_id
        where c.card_set_id = s.id
          and v.variant_key = 'catalog_base'
      ) and coalesce(s.checklist_scope_note, '') like 'Première passe du catalogue:%'
        then 'Suivi de base activé pour les cartes répertoriées. Les cartes sans inventaire détaillé de variantes utilisent l’entrée générique « Carte (suivi de base) » ; les finitions exactes et promos restent à compléter.'
      when exists (
        select 1
        from public.card_print_variants v
        join public.cards c on c.id = v.card_id
        where c.card_set_id = s.id
          and v.variant_key = 'catalog_base'
      ) and position('Carte (suivi de base)' in coalesce(s.checklist_scope_note, '')) = 0
        then concat_ws(
          ' ',
          nullif(trim(s.checklist_scope_note), ''),
          'Suivi de base activé pour les cartes répertoriées. Les cartes sans inventaire détaillé de variantes utilisent l’entrée générique « Carte (suivi de base) » ; les finitions exactes et promos restent à compléter.'
        )
      else s.checklist_scope_note
    end
where s.language = 'FR'
  and exists (select 1 from public.cards c where c.card_set_id = s.id);

commit;
