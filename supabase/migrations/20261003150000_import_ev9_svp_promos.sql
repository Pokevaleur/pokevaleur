-- Ajoute les 9 promos SVP distribuées avec les produits français liés à EV9.
-- Produit et numéros 185–186 vérifiés dans le livret français EV9 p. 35–36 et l’encyclopédie officielle Pokémon.
-- Elles restent identifiables dans un filtre distinct ; le compteur officiel EV9 demeure à 159.
with target_set as (
  select id
  from public.card_sets
  where set_code = 'SV09' and language = 'FR'
),
set_note as (
  update public.card_sets
  set checklist_scope_note = 'Checklist de travail EV9 : 190 cartes numérotées du set (001–190/159 ; 159 cartes officiellement annoncées), 343 variantes standard/reverse/holo et 42 variantes tamponnées TCGdex, plus 9 promos SVP en groupe séparé (181–189). Les tampons TCGdex peuvent inclure plusieurs marchés ; langue et provenance restent à vérifier avant publication. Six variantes Jumbo restent exclues. Série privée.'
  where set_code = 'SV09' and language = 'FR'
  returning id
),
promo_input(collector_number,card_name,guide_order,local_id,source_path) as (
  values
    ('SVP 181','Darumacho de N',191,'181','181'),
    ('SVP 182','Fulgulairo de Mashynn',192,'182','182'),
    ('SVP 183','Rubombelle de Lilie',193,'183','183'),
    ('SVP 184','Ronflex de Nabil',194,'184','184'),
    ('SVP 185','Yanma',195,'185','185'),
    ('SVP 186','Baggaïd',196,'186','186'),
    ('SVP 187','Yanmega',197,'187','187'),
    ('SVP 188','Baggaïd',198,'188','188'),
    ('SVP 189','Zorua de N',199,'189','189')
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
select c.id,'promo_holo','Promo brillante','holo',null,'promo',true
from upserted_cards c
on conflict (card_id,variant_key) do update set
  variant_label=excluded.variant_label,finish_code=excluded.finish_code,
  guide_marker=excluded.guide_marker,checklist_group=excluded.checklist_group,
  is_master_set_target=excluded.is_master_set_target;