alter table public.product_contents
  add column content_role text not null default 'guaranteed'
  check (content_role in ('guaranteed', 'possible'));

update public.product_contents pc
set item_name = 'Cartes aléatoires estampillées Play! Pokémon',
    quantity = 6,
    content_role = 'guaranteed'
from public.products p
where p.id = pc.product_id
  and p.name like 'Pack Récompense Play! Pokémon – Série %';

update public.product_contents pc
set item_name = 'Cartes promotionnelles aléatoires (au moins une brillante)',
    quantity = 4,
    content_role = 'guaranteed'
from public.products p
where p.id = pc.product_id
  and p.name = 'Booster promotionnel McDonald’s Pokémon 2024 (M24FR)';


-- Official Series Seven checklist: record the 96 card identities that may appear.
with wanted(set_code, collector_number) as (
  values
('sv05', '24'),
('sv05', '85'),
('sv05', '114'),
('sv05', '129'),
('sv05', '142'),
('sv05', '144'),
('sv05', '157'),
('sv06', '25'),
('sv06', '53'),
('sv06', '77'),
('sv06', '95'),
('sv06', '105'),
('sv06', '106'),
('sv06', '131'),
('sv06', '134'),
('sv06', '141'),
('sv06', '143'),
('sv06', '145'),
('sv06', '148'),
('sv06', '153'),
('sv06.5', '2'),
('sv06.5', '19'),
('sv06.5', '20'),
('sv06.5', '38'),
('sv06.5', '57'),
('sv06.5', '61'),
('sv06.5', '63'),
('sv07', '50'),
('sv07', '107'),
('sv07', '115'),
('sv07', '118'),
('sv07', '119'),
('sv07', '128'),
('sv07', '131'),
('sv07', '132'),
('sv07', '133'),
('sv07', '135'),
('sv07', '142'),
('sv08', '19'),
('sv08', '36'),
('sv08', '57'),
('sv08', '59'),
('sv08', '65'),
('sv08', '74'),
('sv08', '76'),
('sv08', '86'),
('sv08', '107'),
('sv08', '130'),
('sv08', '143'),
('sv08', '161'),
('sv08', '164'),
('sv08', '169'),
('sv08', '177'),
('sv08', '186'),
('sv08', '189'),
('sv08.5', '4'),
('sv08.5', '6'),
('sv08.5', '14'),
('sv08.5', '23'),
('sv08.5', '26'),
('sv08.5', '30'),
('sv08.5', '34'),
('sv08.5', '60'),
('sv08.5', '75'),
('sv08.5', '86'),
('sv08.5', '116'),
('SV09', '27'),
('SV09', '47'),
('SV09', '53'),
('SV09', '55'),
('SV09', '56'),
('SV09', '67'),
('SV09', '79'),
('SV09', '95'),
('SV09', '98'),
('SV09', '111'),
('SV09', '116'),
('SV09', '117'),
('SV09', '136'),
('SV09', '146'),
('SV09', '147'),
('SV09', '148'),
('SV09', '149'),
('SV09', '150'),
('SV09', '151'),
('SV09', '152'),
('SV09', '153'),
('SV09', '154'),
('sve', '9'),
('sve', '10'),
('sve', '11'),
('sve', '12'),
('sve', '13'),
('sve', '14'),
('sve', '15'),
('sve', '16')
), pool_cards as (
  select distinct c.id as card_id,
         c.card_name || ' — ' || cs.set_name || ' ' || c.collector_number || ' (estampille Play! Pokémon)' as item_name
  from wanted w
  join public.card_sets cs on cs.set_code = w.set_code and cs.language = 'FR'
  join public.cards c on c.card_set_id = cs.id
    and ltrim(split_part(c.collector_number, '/', 1), '0') = w.collector_number
)
insert into public.product_contents (
  product_id, content_type, item_name, quantity, source_url, source_label, confidence, card_id, content_role
)
select p.id,
       'other',
       pool_cards.item_name,
       1,
       'https://www.pokemon.com/static-assets/content-assets/cms2/pdf/trading-card-game/checklist/prize_pack_series_7_web_cardlist_en.pdf',
       'Pokémon — checklist officielle du Pack Récompense série 7',
       'verified',
       pool_cards.card_id,
       'possible'
from public.products p
cross join pool_cards
where p.name = 'Pack Récompense Play! Pokémon – Série 7'
  and not exists (
    select 1
    from public.product_contents existing
    where existing.product_id = p.id
      and existing.card_id = pool_cards.card_id
      and existing.content_role = 'possible'
  );


-- Official Series Six checklist: record its 94 possible card identities.
with wanted(set_code, collector_number) as (
  values
('sv03', '125'),
('sv03', '164'),
('sv03', '196'),
('sv03.5', '132'),
('sv03.5', '151'),
('sv04', '70'),
('sv04', '121'),
('sv04', '124'),
('sv04', '160'),
('sv04', '163'),
('sv04', '170'),
('sv04', '171'),
('sv04', '176'),
('sv04', '177'),
('sv04', '178'),
('sv04', '179'),
('sv04', '180'),
('sv04.5', '90'),
('sv05', '81'),
('sv05', '97'),
('sv05', '109'),
('sv05', '114'),
('sv05', '119'),
('sv05', '121'),
('sv05', '123'),
('sv05', '144'),
('sv05', '145'),
('sv05', '147'),
('sv05', '154'),
('sv05', '155'),
('sv05', '157'),
('sv05', '159'),
('sv06', '25'),
('sv06', '33'),
('sv06', '40'),
('sv06', '53'),
('sv06', '64'),
('sv06', '72'),
('sv06', '77'),
('sv06', '84'),
('sv06', '95'),
('sv06', '96'),
('sv06', '111'),
('sv06', '112'),
('sv06', '123'),
('sv06', '129'),
('sv06', '130'),
('sv06', '131'),
('sv06', '141'),
('sv06', '143'),
('sv06', '145'),
('sv06', '148'),
('sv06', '152'),
('sv06', '153'),
('sv06', '159'),
('sv06', '162'),
('sv06', '164'),
('sv06', '165'),
('sv06', '167'),
('sv06.5', '2'),
('sv06.5', '36'),
('sv06.5', '37'),
('sv06.5', '38'),
('sv06.5', '39'),
('sv06.5', '40'),
('sv06.5', '42'),
('sv06.5', '55'),
('sv06.5', '57'),
('sv06.5', '59'),
('sv06.5', '60'),
('sv06.5', '61'),
('sv06.5', '63'),
('sv07', '3'),
('sv07', '51'),
('sv07', '71'),
('sv07', '107'),
('sv07', '111'),
('sv07', '115'),
('sv07', '118'),
('sv07', '119'),
('sv07', '128'),
('sv07', '131'),
('sv07', '133'),
('sv07', '135'),
('sv07', '136'),
('sv07', '142'),
('sve', '9'),
('sve', '10'),
('sve', '11'),
('sve', '12'),
('sve', '13'),
('sve', '14'),
('sve', '15'),
('sve', '16')
), pool_cards as (
  select distinct c.id as card_id,
         c.card_name || ' — ' || cs.set_name || ' ' || c.collector_number || ' (estampille Play! Pokémon)' as item_name
  from wanted w
  join public.card_sets cs on cs.set_code = w.set_code and cs.language = 'FR'
  join public.cards c on c.card_set_id = cs.id
    and ltrim(split_part(c.collector_number, '/', 1), '0') = w.collector_number
)
insert into public.product_contents (
  product_id, content_type, item_name, quantity, source_url, source_label, confidence, card_id, content_role
)
select p.id,
       'other',
       pool_cards.item_name,
       1,
       'https://www.pokemon.com/static-assets/content-assets/cms2/pdf/trading-card-game/checklist/prize_pack_series_6_web_cardlist_en.pdf',
       'Pokémon — checklist officielle du Pack Récompense série 6',
       'verified',
       pool_cards.card_id,
       'possible'
from public.products p
cross join pool_cards
where p.name = 'Pack Récompense Play! Pokémon – Série 6'
  and not exists (
    select 1
    from public.product_contents existing
    where existing.product_id = p.id
      and existing.card_id = pool_cards.card_id
      and existing.content_role = 'possible'
  );


-- Official Series Five checklist: record its 86 possible card identities.
with wanted(set_code, collector_number) as (
  values
('sv01', '81'),
('sv01', '86'),
('sv01', '166'),
('sv01', '176'),
('sv01', '181'),
('sv01', '189'),
('sv01', '190'),
('sv01', '191'),
('sv01', '194'),
('sv01', '196'),
('sv02', '5'),
('sv02', '60'),
('sv02', '61'),
('sv02', '169'),
('sv02', '172'),
('sv02', '185'),
('sv02', '188'),
('sv02', '190'),
('sv02', '192'),
('sv03', '125'),
('sv03', '164'),
('sv03.5', '85'),
('sv03.5', '151'),
('sv04', '38'),
('sv04', '58'),
('sv04', '70'),
('sv04', '72'),
('sv04', '89'),
('sv04', '93'),
('sv04', '104'),
('sv04', '108'),
('sv04', '121'),
('sv04', '123'),
('sv04', '124'),
('sv04', '126'),
('sv04', '137'),
('sv04', '139'),
('sv04', '159'),
('sv04', '160'),
('sv04', '163'),
('sv04', '164'),
('sv04', '166'),
('sv04', '167'),
('sv04', '170'),
('sv04', '171'),
('sv04', '177'),
('sv04', '178'),
('sv04', '180'),
('sv04', '181'),
('sv04.5', '77'),
('sv04.5', '81'),
('sv05', '12'),
('sv05', '21'),
('sv05', '24'),
('sv05', '41'),
('sv05', '78'),
('sv05', '81'),
('sv05', '108'),
('sv05', '109'),
('sv05', '119'),
('sv05', '121'),
('sv05', '123'),
('sv05', '141'),
('sv05', '144'),
('sv05', '145'),
('sv05', '147'),
('sv05', '148'),
('sv05', '151'),
('sv05', '152'),
('sv05', '154'),
('sv05', '155'),
('sv05', '156'),
('sv05', '157'),
('sv05', '158'),
('sv05', '159'),
('sv05', '160'),
('sv05', '161'),
('sv05', '162'),
('sve', '1'),
('sve', '2'),
('sve', '3'),
('sve', '4'),
('sve', '5'),
('sve', '6'),
('sve', '7'),
('sve', '8')
), pool_cards as (
  select distinct c.id as card_id,
         c.card_name || ' — ' || cs.set_name || ' ' || c.collector_number || ' (estampille Play! Pokémon)' as item_name
  from wanted w
  join public.card_sets cs on cs.set_code = w.set_code and cs.language = 'FR'
  join public.cards c on c.card_set_id = cs.id
    and ltrim(split_part(c.collector_number, '/', 1), '0') = w.collector_number
)
insert into public.product_contents (
  product_id, content_type, item_name, quantity, source_url, source_label, confidence, card_id, content_role
)
select p.id,
       'other',
       pool_cards.item_name,
       1,
       'https://www.pokemon.com/static-assets/content-assets/cms2/pdf/trading-card-game/checklist/prize_pack_series_5_web_cardlist_en.pdf',
       'Pokémon — checklist officielle du Pack Récompense série 5',
       'verified',
       pool_cards.card_id,
       'possible'
from public.products p
cross join pool_cards
where p.name = 'Pack Récompense Play! Pokémon – Série 5'
  and not exists (
    select 1
    from public.product_contents existing
    where existing.product_id = p.id
      and existing.card_id = pool_cards.card_id
      and existing.content_role = 'possible'
  );


-- Official Series Four checklist: record its 86 possible card identities.
with wanted(set_code, collector_number) as (
  values
('swsh11', '130'),
('swsh11', '131'),
('swsh11', '135'),
('swsh11', '136'),
('swsh11', '153'),
('swsh11', '161'),
('swsh12', '38'),
('swsh12', '57'),
('swsh12', '58'),
('swsh12', '68'),
('swsh12', '131'),
('swsh12', '135'),
('swsh12', '136'),
('swsh12', '138'),
('swsh12', '139'),
('swsh12', '147'),
('swsh12', '153'),
('swsh12', '155'),
('swsh12', '156'),
('swsh12', '167'),
('swsh12.5', '36'),
('swsh12.5', '135'),
('swsh12.5', '143'),
('swsh12.5', '145'),
('swsh12.5', '146'),
('sv01', '41'),
('sv01', '54'),
('sv01', '81'),
('sv01', '86'),
('sv01', '89'),
('sv01', '96'),
('sv01', '125'),
('sv01', '142'),
('sv01', '166'),
('sv01', '167'),
('sv01', '169'),
('sv01', '170'),
('sv01', '175'),
('sv01', '176'),
('sv01', '181'),
('sv01', '182'),
('sv01', '183'),
('sv01', '189'),
('sv01', '190'),
('sv01', '191'),
('sv01', '194'),
('sv01', '196'),
('sv02', '5'),
('sv02', '15'),
('sv02', '37'),
('sv02', '60'),
('sv02', '61'),
('sv02', '71'),
('sv02', '89'),
('sv02', '93'),
('sv02', '97'),
('sv02', '127'),
('sv02', '153'),
('sv02', '159'),
('sv02', '169'),
('sv02', '171'),
('sv02', '172'),
('sv02', '173'),
('sv02', '177'),
('sv02', '181'),
('sv02', '185'),
('sv02', '188'),
('sv02', '189'),
('sv02', '190'),
('sv02', '191'),
('sv02', '192'),
('sv03', '22'),
('sv03', '66'),
('sv03', '92'),
('sv03', '95'),
('sv03', '125'),
('sv03', '164'),
('sv03', '189'),
('sve', '1'),
('sve', '2'),
('sve', '3'),
('sve', '4'),
('sve', '5'),
('sve', '6'),
('sve', '7'),
('sve', '8')
), pool_cards as (
  select distinct c.id as card_id,
         c.card_name || ' — ' || cs.set_name || ' ' || c.collector_number || ' (estampille Play! Pokémon)' as item_name
  from wanted w
  join public.card_sets cs on cs.set_code = w.set_code and cs.language = 'FR'
  join public.cards c on c.card_set_id = cs.id
    and ltrim(split_part(c.collector_number, '/', 1), '0') = w.collector_number
)
insert into public.product_contents (
  product_id, content_type, item_name, quantity, source_url, source_label, confidence, card_id, content_role
)
select p.id,
       'other',
       pool_cards.item_name,
       1,
       'https://www.pokemon.com/static-assets/content-assets/cms2/pdf/trading-card-game/checklist/prize_pack_series_4_web_cardlist_en.pdf',
       'Pokémon — checklist officielle du Pack Récompense série 4',
       'verified',
       pool_cards.card_id,
       'possible'
from public.products p
cross join pool_cards
where p.name = 'Pack Récompense Play! Pokémon – Série 4'
  and not exists (
    select 1
    from public.product_contents existing
    where existing.product_id = p.id
      and existing.card_id = pool_cards.card_id
      and existing.content_role = 'possible'
  );



-- Official Series Three checklist: record 155 card identities and eight unnamed basic energy prints.
with wanted(set_code, collector_number) as (
  values
('swsh9', '7'),
('swsh9', '21'),
('swsh9', '22'),
('swsh9', '40'),
('swsh9', '41'),
('swsh9', '45'),
('swsh9', '48'),
('swsh9', '91'),
('swsh9', '121'),
('swsh9', '122'),
('swsh9', '123'),
('swsh9', '126'),
('swsh9', '132'),
('swsh9', '134'),
('swsh9', '137'),
('swsh9', '138'),
('swsh9', '144'),
('swsh9', '146'),
('swsh9', '148'),
('swsh9', '151'),
('swsh10', '27'),
('swsh10', '30'),
('swsh10', '37'),
('swsh10', '39'),
('swsh10', '40'),
('swsh10', '43'),
('swsh10', '46'),
('swsh10', '51'),
('swsh10', '62'),
('swsh10', '68'),
('swsh10', '75'),
('swsh10', '81'),
('swsh10', '108'),
('swsh10', '113'),
('swsh10', '114'),
('swsh10', '118'),
('swsh10', '130'),
('swsh10', '136'),
('swsh10', '138'),
('swsh10', '139'),
('swsh10', '141'),
('swsh10', '142'),
('swsh10', '143'),
('swsh10', '144'),
('swsh10', '145'),
('swsh10', '146'),
('swsh10', '147'),
('swsh10', '150'),
('swsh10', '154'),
('swsh10', '155'),
('swsh10.5', '30'),
('swsh10.5', '31'),
('swsh11', '48'),
('swsh11', '49'),
('swsh11', '50'),
('swsh11', '62'),
('swsh11', '66'),
('swsh11', '69'),
('swsh11', '70'),
('swsh11', '73'),
('swsh11', '79'),
('swsh11', '84'),
('swsh11', '118'),
('swsh11', '119'),
('swsh11', '123'),
('swsh11', '124'),
('swsh11', '130'),
('swsh11', '131'),
('swsh11', '135'),
('swsh11', '136'),
('swsh11', '143'),
('swsh11', '146'),
('swsh11', '147'),
('swsh11', '153'),
('swsh11', '155'),
('swsh11', '156'),
('swsh11', '160'),
('swsh11', '161'),
('swsh11', '163'),
('swsh11', '167'),
('swsh11', '168'),
('swsh12', '16'),
('swsh12', '33'),
('swsh12', '34'),
('swsh12', '38'),
('swsh12', '57'),
('swsh12', '58'),
('swsh12', '59'),
('swsh12', '68'),
('swsh12', '90'),
('swsh12', '120'),
('swsh12', '131'),
('swsh12', '135'),
('swsh12', '136'),
('swsh12', '138'),
('swsh12', '139'),
('swsh12', '140'),
('swsh12', '147'),
('swsh12', '154'),
('swsh12', '156'),
('swsh12', '159'),
('swsh12', '160'),
('swsh12', '164'),
('swsh12', '169'),
('swsh12.5', '20'),
('swsh12.5', '51'),
('swsh12.5', '62'),
('swsh12.5', '69'),
('swsh12.5', '105'),
('swsh12.5', '107'),
('swsh12.5', '135'),
('swsh12.5', '143'),
('swsh12.5', '145'),
('swsh12.5', '146'),
('svp', '4'),
('svp', '16'),
('svp', '17'),
('svp', '18'),
('sv01', '19'),
('sv01', '41'),
('sv01', '43'),
('sv01', '61'),
('sv01', '62'),
('sv01', '65'),
('sv01', '76'),
('sv01', '81'),
('sv01', '86'),
('sv01', '88'),
('sv01', '109'),
('sv01', '114'),
('sv01', '118'),
('sv01', '123'),
('sv01', '125'),
('sv01', '127'),
('sv01', '131'),
('sv01', '134'),
('sv01', '142'),
('sv01', '143'),
('sv01', '151'),
('sv01', '158'),
('sv01', '166'),
('sv01', '167'),
('sv01', '169'),
('sv01', '170'),
('sv01', '175'),
('sv01', '179'),
('sv01', '181'),
('sv01', '183'),
('sv01', '186'),
('sv01', '189'),
('sv01', '190'),
('sv01', '191'),
('sv01', '194'),
('sv01', '195'),
('sv01', '196'),
('sve', '8')
), pool_cards as (
  select distinct c.id as card_id,
         c.card_name || ' — ' || cs.set_name || ' ' || c.collector_number || ' (estampille Play! Pokémon)' as item_name
  from wanted w
  join public.card_sets cs on cs.set_code = w.set_code and cs.language = 'FR'
  join public.cards c on c.card_set_id = cs.id
    and ltrim(split_part(c.collector_number, '/', 1), '0') = w.collector_number
)
insert into public.product_contents (
  product_id, content_type, item_name, quantity, source_url, source_label, confidence, card_id, content_role
)
select p.id,
       'other',
       pool_cards.item_name,
       1,
       'https://www.pokemon.com/static-assets/content-assets/cms2/pdf/trading-card-game/checklist/prize_pack_series_3_web_cardlist_en.pdf',
       'Pokémon — checklist officielle du Pack Récompense série 3',
       'verified',
       pool_cards.card_id,
       'possible'
from public.products p
cross join pool_cards
where p.name = 'Pack Récompense Play! Pokémon – Série 3'
  and not exists (
    select 1
    from public.product_contents existing
    where existing.product_id = p.id
      and existing.card_id = pool_cards.card_id
      and existing.content_role = 'possible'
  );



-- Basic Energy cards appear on the official Series Three checklist without collector numbers.
with energy_names(product_name, item_name) as (
  values
('Pack Récompense série 3', 'Énergie Plante (estampille Play! Pokémon)'),
('Pack Récompense série 3', 'Énergie Feu (estampille Play! Pokémon)'),
('Pack Récompense série 3', 'Énergie Eau (estampille Play! Pokémon)'),
('Pack Récompense série 3', 'Énergie Électrique (estampille Play! Pokémon)'),
('Pack Récompense série 3', 'Énergie Psy (estampille Play! Pokémon)'),
('Pack Récompense série 3', 'Énergie Combat (estampille Play! Pokémon)'),
('Pack Récompense série 3', 'Énergie Obscurité (estampille Play! Pokémon)'),
('Pack Récompense série 3', 'Énergie Métal (estampille Play! Pokémon)')
)
insert into public.product_contents (
  product_id, content_type, item_name, quantity, source_url, source_label, confidence, content_role
)
select p.id,
       'other',
       e.item_name,
       1,
       'https://www.pokemon.com/static-assets/content-assets/cms2/pdf/trading-card-game/checklist/prize_pack_series_3_web_cardlist_en.pdf',
       'Pokémon — checklist officielle du Pack Récompense série 3',
       'verified',
       'possible'
from public.products p
cross join energy_names e
where p.name = e.product_name
  and not exists (
    select 1
    from public.product_contents existing
    where existing.product_id = p.id
      and existing.item_name = e.item_name
      and existing.content_role = 'possible'
  );
