-- Ajoute les 9 promos SVP liées aux produits EV9 : 7 françaises et 2 internationales gardées hors Ultra Master FR.
-- Les fiches Pokémon confirment SVP 185–186 ; le pays de distribution de leurs blisters reste à confirmer.
-- Produit et numéros 185–186 vérifiés dans le livret français EV9 p. 35–36 et l’encyclopédie officielle Pokémon.
-- Elles restent identifiables dans un filtre distinct ; le compteur officiel EV9 demeure à 159.
with target_set as (
  select id
  from public.card_sets
  where set_code = 'SV09' and language = 'FR'
),
set_note as (
  update public.card_sets
  set checklist_scope_note = 'Checklist française de travail EV9 : 369 variantes (339 principales = 333 de base + 6 finitions promo, 30 tampons français). Les 4 variantes cosmos et 11 tampons hors périmètre restent visibles sans compter. Les 9 promos SVP liées aux produits EV9 sont suivies à part ; sept sont françaises (181–184, 187–189) et deux restent hors périmètre français (185–186, marché à confirmer). Cinq versions Jumbo sont identifiées (024, 030, 069, 114 et SVP 193) et exclues du total de 369 ; la sixième reste à rapprocher. Série privée.'
  where set_code = 'SV09' and language = 'FR'
  returning id
),
promo_input(collector_number,card_name,guide_order,local_id,source_path,is_master_set_target) as (
  values
    ('SVP 181','Darumacho de N',191,'181','181',true),
    ('SVP 182','Fulgulairo de Mashynn',192,'182','182',true),
    ('SVP 183','Rubombelle de Lilie',193,'183','183',true),
    ('SVP 184','Ronflex de Nabil',194,'184','184',true),
    ('SVP 185','Yanma',195,'185','185',false),
    ('SVP 186','Baggiguane',196,'186','186',false),
    ('SVP 187','Yanmega',197,'187','187',true),
    ('SVP 188','Baggaïd',198,'188','188',true),
    ('SVP 189','Zorua de N',199,'189','189',true)
),
upserted_cards as (
  insert into public.cards (
    card_set_id,collector_number,card_name,card_type,guide_category_label,guide_category_code,
    rarity_label,mechanic_label,illustration_style,guide_order,image_url,image_source_url,source_url
  )
  select
    s.id,p.collector_number,p.card_name,'Pokémon','Promo SVP','promo_svp',
    'Promo',null,null,p.guide_order,
    'https://assets.tcgdex.net/fr/sv/svp/'||p.local_id||'/low.webp',
    'https://api.tcgdex.net/v2/fr/cards/svp-'||p.source_path,
    'https://www.pokemon.com/fr/jcc-pokemon/cartes-pokemon/series/svp/'||p.local_id
  from promo_input p
  cross join target_set s
  on conflict (card_set_id,collector_number) do update set
    card_name=excluded.card_name,card_type=excluded.card_type,
    guide_category_label=excluded.guide_category_label,guide_category_code=excluded.guide_category_code,
    rarity_label=excluded.rarity_label,guide_order=excluded.guide_order,image_url=excluded.image_url,
    image_source_url=excluded.image_source_url,source_url=excluded.source_url
  returning id,collector_number
)
insert into public.card_print_variants (
  card_id,variant_key,variant_label,finish_code,guide_marker,checklist_group,is_master_set_target
)
select c.id,'promo_holo',
  case when not p.is_master_set_target then 'Promo brillante · hors Ultra Master français' else 'Promo brillante' end,
  'holo',null,'promo',p.is_master_set_target
from upserted_cards c
join promo_input p using (collector_number)
on conflict (card_id,variant_key) do update set
  variant_label=excluded.variant_label,finish_code=excluded.finish_code,
  guide_marker=excluded.guide_marker,checklist_group=excluded.checklist_group,
  is_master_set_target=excluded.is_master_set_target;