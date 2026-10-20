alter table public.guide_questions
  add column if not exists image_gallery jsonb not null default '[]'::jsonb;

insert into public.guide_questions (
  id, topic_id, question, answer, sort_order, is_published, image_gallery
)
select
  'boosters-qu-est-ce-qu-un-artset',
  'boosters',
  'Qu’est-ce qu’un Artset de boosters ?',
  'Un Artset (ou art set) est un ensemble de boosters d’une même série qui réunit une fois chaque visuel de pochette. Ce terme de collectionneur décrit les illustrations réunies ; il ne désigne pas un produit scellé officiel.\n\nDans Épée et Bouclier – Évolution Céleste, l’exemple illustré ci-dessous comprend les quatre visuels de boosters : Duralugon, Noctali, Nymphali et Rayquaza. Pour compléter cet artset, on recherche un exemplaire de chacun des quatre visuels. La composition peut varier selon les séries et les versions linguistiques.',
  coalesce((select max(sort_order) from public.guide_questions where topic_id = 'boosters'), 0) + 1,
  true,
  '[
    {"path":"https://www.pokepedia.fr/images/f/f2/Booster_%C3%89p%C3%A9e_et_Bouclier_%C3%89volution_C%C3%A9leste_Duralugon_Gigamax.png","alt":"Booster Évolution Céleste illustré par Duralugon Gigamax","source_url":"https://www.pokepedia.fr/Fichier:Booster_%C3%89p%C3%A9e_et_Bouclier_%C3%89volution_C%C3%A9leste_Duralugon_Gigamax.png","source_label":"Source Poképédia"},
    {"path":"https://www.pokepedia.fr/images/d/de/Booster_%C3%89p%C3%A9e_et_Bouclier_%C3%89volution_C%C3%A9leste_Noctali.png","alt":"Booster Évolution Céleste illustré par Noctali","source_url":"https://www.pokepedia.fr/Fichier:Booster_%C3%89p%C3%A9e_et_Bouclier_%C3%89volution_C%C3%A9leste_Noctali.png","source_label":"Source Poképédia"},
    {"path":"https://www.pokepedia.fr/images/f/fe/Booster_%C3%89p%C3%A9e_et_Bouclier_%C3%89volution_C%C3%A9leste_Nymphali.png","alt":"Booster Évolution Céleste illustré par Nymphali","source_url":"https://www.pokepedia.fr/Fichier:Booster_%C3%89p%C3%A9e_et_Bouclier_%C3%89volution_C%C3%A9leste_Nymphali.png","source_label":"Source Poképédia"},
    {"path":"https://www.pokepedia.fr/images/9/9a/Booster_%C3%89p%C3%A9e_et_Bouclier_%C3%89volution_C%C3%A9leste_Rayquaza.png","alt":"Booster Évolution Céleste illustré par Rayquaza","source_url":"https://www.pokepedia.fr/Fichier:Booster_%C3%89p%C3%A9e_et_Bouclier_%C3%89volution_C%C3%A9leste_Rayquaza.png","source_label":"Source Poképédia"}
  ]'::jsonb
where not exists (
  select 1 from public.guide_questions where id = 'boosters-qu-est-ce-qu-un-artset'
);