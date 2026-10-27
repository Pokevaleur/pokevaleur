-- Complete the French SL09 / Duo de Choc base checklist from the supplied
-- Full Set and Master Set sheets. Keep internal TCGdex code sm9 unchanged.
-- Existing generic catalog_base rows are reclassified in place so any
-- collection_cards foreign keys continue to reference the same variant IDs.
-- The four Prism Star Reverse rows from the earlier broad seed remain in the
-- catalogue but are excluded from this checklist's Master Set target.

begin;

do $$
declare
  target_set_id uuid;
  actual_card_count integer;
  missing_reverse_numbers text[];
begin
  select id into target_set_id
  from public.card_sets
  where lower(set_code) = 'sm9' and language = 'FR'
  limit 1;

  if target_set_id is null then
    raise exception 'French SM9 / Duo de Choc card set was not found';
  end if;

  select count(*) into actual_card_count
  from public.cards
  where card_set_id = target_set_id;

  if actual_card_count <> 196 then
    raise exception 'Expected 196 French Duo de Choc catalogue cards, found %', actual_card_count;
  end if;

  select array_agg(required.collector_number order by required.collector_number)
  into missing_reverse_numbers
  from (values
    ('2'), ('3'), ('4'), ('5'), ('6'), ('7'), ('8'), ('9'), ('11'), ('12'),
    ('13'), ('14'), ('15'), ('16'), ('17'), ('18'), ('19'), ('20'), ('21'),
    ('22'), ('23'), ('24'), ('25'), ('26'), ('27'), ('28'), ('29'), ('30'),
    ('31'), ('32'), ('34'), ('35'), ('36'), ('37'), ('38'), ('39'), ('40'),
    ('41'), ('42'), ('44'), ('45'), ('46'), ('47'), ('48'), ('49'), ('50'),
    ('52'), ('54'), ('55'), ('56'), ('57'), ('58'), ('59'), ('60'), ('61'),
    ('62'), ('63'), ('64'), ('65'), ('66'), ('68'), ('69'), ('70'), ('71'),
    ('72'), ('73'), ('74'), ('75'), ('76'), ('77'), ('78'), ('79'), ('80'),
    ('81'), ('83'), ('84'), ('85'), ('86'), ('87'), ('88'), ('89'), ('90'),
    ('91'), ('92'), ('93'), ('94'), ('95'), ('98'), ('99'), ('100'),
    ('101'), ('102'), ('103'), ('104'), ('105'), ('107'), ('108'), ('109'),
    ('110'), ('111'), ('112'), ('114'), ('115'), ('116'), ('117'), ('118'),
    ('119'), ('121'), ('122'), ('123'), ('124'), ('125'), ('126'), ('127'),
    ('128'), ('129'), ('130'), ('131'), ('132'), ('133'), ('135'), ('136'),
    ('137'), ('138'), ('139'), ('140'), ('141'), ('142'), ('143'), ('144'),
    ('145'), ('146'), ('147'), ('148'), ('149'), ('150'), ('151'), ('152'),
    ('153'), ('154'), ('155'), ('156'), ('157')
  ) as required(collector_number)
  left join public.cards c
    on c.card_set_id = target_set_id
   and c.collector_number = required.collector_number
  where c.id is null;

  if missing_reverse_numbers is not null then
    raise exception 'SL09 Reverse checklist references missing cards: %', missing_reverse_numbers;
  end if;
end;
$$;

-- Reclassify generic entries without changing their IDs or collection links.
update public.card_print_variants v
set variant_key = expected.variant_key,
    variant_label = expected.variant_label,
    finish_code = expected.finish_code,
    checklist_group = 'main',
    is_master_set_target = true
from public.cards c
join public.card_sets s on s.id = c.card_set_id
cross join lateral (
  select
    case when c.collector_number in (
      '1','10','19','30','32','33','39','40','43','51','52','53','67','76',
      '82','85','88','91','95','96','97','99','106','109','111','113','119',
      '120','131','132','133','134','140','158','159','160','161','162','163',
      '164','165','166','167','168','169','170','171','172','173','174','175',
      '176','177','178','179','180','181','182','183','184','185','186','187',
      '188','189','190','191','192','193','194','195','196'
    ) then 'holo' else 'normal' end as variant_key,
    case when c.collector_number in (
      '1','10','19','30','32','33','39','40','43','51','52','53','67','76',
      '82','85','88','91','95','96','97','99','106','109','111','113','119',
      '120','131','132','133','134','140','158','159','160','161','162','163',
      '164','165','166','167','168','169','170','171','172','173','174','175',
      '176','177','178','179','180','181','182','183','184','185','186','187',
      '188','189','190','191','192','193','194','195','196'
    ) then 'Holo' else 'Normale' end as variant_label,
    case when c.collector_number in (
      '1','10','19','30','32','33','39','40','43','51','52','53','67','76',
      '82','85','88','91','95','96','97','99','106','109','111','113','119',
      '120','131','132','133','134','140','158','159','160','161','162','163',
      '164','165','166','167','168','169','170','171','172','173','174','175',
      '176','177','178','179','180','181','182','183','184','185','186','187',
      '188','189','190','191','192','193','194','195','196'
    ) then 'holo' else 'normal' end as finish_code
) expected
where s.set_code = 'sm9'
  and s.language = 'FR'
  and v.card_id = c.id
  and v.variant_key = 'catalog_base'
  and not exists (
    select 1
    from public.card_print_variants existing
    where existing.card_id = c.id
      and existing.variant_key = expected.variant_key
  );

-- Add base printings where no specific variant exists yet. Idempotent on
-- card/key and safe for databases that already have the detailed checklist.
insert into public.card_print_variants (
  card_id, variant_key, variant_label, finish_code, checklist_group, is_master_set_target
)
select
  c.id,
  expected.variant_key,
  expected.variant_label,
  expected.finish_code,
  'main',
  true
from public.cards c
join public.card_sets s on s.id = c.card_set_id
cross join lateral (
  select
    case when c.collector_number in (
      '1','10','19','30','32','33','39','40','43','51','52','53','67','76',
      '82','85','88','91','95','96','97','99','106','109','111','113','119',
      '120','131','132','133','134','140','158','159','160','161','162','163',
      '164','165','166','167','168','169','170','171','172','173','174','175',
      '176','177','178','179','180','181','182','183','184','185','186','187',
      '188','189','190','191','192','193','194','195','196'
    ) then 'holo' else 'normal' end as variant_key,
    case when c.collector_number in (
      '1','10','19','30','32','33','39','40','43','51','52','53','67','76',
      '82','85','88','91','95','96','97','99','106','109','111','113','119',
      '120','131','132','133','134','140','158','159','160','161','162','163',
      '164','165','166','167','168','169','170','171','172','173','174','175',
      '176','177','178','179','180','181','182','183','184','185','186','187',
      '188','189','190','191','192','193','194','195','196'
    ) then 'Holo' else 'Normale' end as variant_label,
    case when c.collector_number in (
      '1','10','19','30','32','33','39','40','43','51','52','53','67','76',
      '82','85','88','91','95','96','97','99','106','109','111','113','119',
      '120','131','132','133','134','140','158','159','160','161','162','163',
      '164','165','166','167','168','169','170','171','172','173','174','175',
      '176','177','178','179','180','181','182','183','184','185','186','187',
      '188','189','190','191','192','193','194','195','196'
    ) then 'holo' else 'normal' end as finish_code
) expected
where s.set_code = 'sm9'
  and s.language = 'FR'
  and not exists (
    select 1 from public.card_print_variants existing
    where existing.card_id = c.id and existing.variant_key = expected.variant_key
  )
on conflict (card_id, variant_key) do nothing;

-- The printed Master checklist has exactly these 143 Reverse cards.
insert into public.card_print_variants (
  card_id, variant_key, variant_label, finish_code, checklist_group, is_master_set_target
)
select
  c.id,
  'reverse',
  'Reverse',
  'reverse',
  'main',
  true
from public.cards c
join public.card_sets s on s.id = c.card_set_id
join (values
  ('2'), ('3'), ('4'), ('5'), ('6'), ('7'), ('8'), ('9'), ('11'), ('12'),
  ('13'), ('14'), ('15'), ('16'), ('17'), ('18'), ('19'), ('20'), ('21'),
  ('22'), ('23'), ('24'), ('25'), ('26'), ('27'), ('28'), ('29'), ('30'),
  ('31'), ('32'), ('34'), ('35'), ('36'), ('37'), ('38'), ('39'), ('40'),
  ('41'), ('42'), ('44'), ('45'), ('46'), ('47'), ('48'), ('49'), ('50'),
  ('52'), ('54'), ('55'), ('56'), ('57'), ('58'), ('59'), ('60'), ('61'),
  ('62'), ('63'), ('64'), ('65'), ('66'), ('68'), ('69'), ('70'), ('71'),
  ('72'), ('73'), ('74'), ('75'), ('76'), ('77'), ('78'), ('79'), ('80'),
  ('81'), ('83'), ('84'), ('85'), ('86'), ('87'), ('88'), ('89'), ('90'),
  ('91'), ('92'), ('93'), ('94'), ('95'), ('98'), ('99'), ('100'),
  ('101'), ('102'), ('103'), ('104'), ('105'), ('107'), ('108'), ('109'),
  ('110'), ('111'), ('112'), ('114'), ('115'), ('116'), ('117'), ('118'),
  ('119'), ('121'), ('122'), ('123'), ('124'), ('125'), ('126'), ('127'),
  ('128'), ('129'), ('130'), ('131'), ('132'), ('133'), ('135'), ('136'),
  ('137'), ('138'), ('139'), ('140'), ('141'), ('142'), ('143'), ('144'),
  ('145'), ('146'), ('147'), ('148'), ('149'), ('150'), ('151'), ('152'),
  ('153'), ('154'), ('155'), ('156'), ('157')
) as required(collector_number)
  on c.collector_number = required.collector_number
where s.set_code = 'sm9'
  and s.language = 'FR'
on conflict (card_id, variant_key) do nothing;

-- Preserve these already catalogued Prism Star Reverse rows and any existing
-- collection references, but keep them outside the SL09 Master target.
update public.card_print_variants v
set checklist_group = 'outside_master',
    is_master_set_target = false
from public.cards c
join public.card_sets s on s.id = c.card_set_id
where v.card_id = c.id
  and s.set_code = 'sm9'
  and s.language = 'FR'
  and c.collector_number in ('10', '51', '134', '158')
  and v.variant_key = 'reverse';

-- Append scope information without replacing existing source notes.
update public.card_sets s
set checklist_scope_note = concat_ws(
  ' ',
  nullif(trim(s.checklist_scope_note), ''),
  'Checklist FR SL09 Duo de Choc : 196 cartes catalogue, 339 variantes Master Set (124 Normales, 57 Holo et 15 secrètes, plus 143 Reverse). Les 4 variantes Reverse des Prism Stars restent cataloguées hors cible Master.'
)
where s.set_code = 'sm9'
  and s.language = 'FR'
  and position('Checklist FR SL09 Duo de Choc' in coalesce(s.checklist_scope_note, '')) = 0;

commit;
