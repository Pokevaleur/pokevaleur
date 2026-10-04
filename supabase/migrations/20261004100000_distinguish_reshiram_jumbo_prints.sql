-- Separate the two Reshiram ex 030/159 oversized prints: expansion-logo stamped and non-holo Jumbo.
-- Bulbapedia lists the Journey Together stamped Reshiram Jumbo; TCGscreener records a distinct
-- Jumbo (Oversized) · Non-Holo printing. Both remain outside the 369-card French standard total.
-- Sources:
-- https://bulbapedia.bulbagarden.net/wiki/Journey_Together_(TCG)
-- https://tcgscreener.com/pokemon/journey-together/reshiram-ex-promo-expansion-stamp-30

with target_card as (
  select c.id
  from public.cards c
  join public.card_sets s on s.id=c.card_set_id
  where s.set_code='SV09' and s.language='FR' and c.collector_number='030/159'
),
stamped_variant as (
  update public.card_print_variants v
  set variant_label='Carte Jumbo · tampon logo de la série',
      finish_code='jumbo',
      checklist_group='jumbo',
      is_master_set_target=false
  from target_card c
  where v.card_id=c.id and v.variant_key='jumbo'
  returning v.card_id
)
insert into public.card_print_variants (
  card_id,variant_key,variant_label,finish_code,guide_marker,checklist_group,is_master_set_target
)
select c.id,'jumbo_non_holo','Carte Jumbo · non holo','jumbo',null,'jumbo',false
from target_card c
on conflict (card_id,variant_key) do update set
  variant_label=excluded.variant_label,
  finish_code=excluded.finish_code,
  guide_marker=excluded.guide_marker,
  checklist_group=excluded.checklist_group,
  is_master_set_target=excluded.is_master_set_target;

update public.card_sets
set checklist_scope_note='Checklist française de travail EV9 : 369 variantes (339 principales = 333 de base + 6 finitions promo, 30 tampons français). Les 4 variantes cosmos et 11 tampons hors périmètre restent visibles sans compter. Les 9 promos SVP liées aux produits EV9 sont suivies à part ; sept sont françaises (181–184, 187–189) et deux restent hors périmètre français (185–186, marché à confirmer). Six versions Jumbo sont identifiées (024, 030 tamponnée, 030 non holo, 069, 114 et SVP 193) et exclues du total de 369. Série privée.'
where set_code='SV09' and language='FR';
