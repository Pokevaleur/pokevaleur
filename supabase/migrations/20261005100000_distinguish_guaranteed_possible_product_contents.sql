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
