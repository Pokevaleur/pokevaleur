-- Replace generic tracking rows with researched McDonald's print finishes.
-- Update the existing generic row in place so collection_cards references remain valid.
-- Years 2018/2019 and 2021 have parallel normal and holo prints; 2022/2023/2024
-- have one finish per card, with the holo cards identified below.
-- Sources: Poképédia FR set lists and the French 2022/2024 card lists;
-- 2023 holo-card list verified against PokéBeach and Cardmarket.

begin;

do $$
declare
  expected_counts jsonb := '{
    "2018sm-fr": 40,
    "2019sm-fr": 41,
    "2021swsh": 25,
    "2022swsh": 15,
    "2023sv": 15,
    "2024sv": 15
  }'::jsonb;
  target record;
  actual_count integer;
  generic_count integer;
  missing_images integer;
begin
  for target in select key as set_code, value::text::integer as expected_count
    from jsonb_each(expected_counts)
  loop
    select count(*) into actual_count
    from public.cards c
    join public.card_sets s on s.id = c.card_set_id
    where s.set_code = target.set_code and s.language = 'FR';

    if actual_count <> target.expected_count then
      raise exception 'Expected % French McDonald''s % cards; found %', target.expected_count, target.set_code, actual_count;
    end if;

    select count(*) into generic_count
    from public.cards c
    join public.card_sets s on s.id = c.card_set_id
    join public.card_print_variants v on v.card_id = c.id and v.variant_key = 'catalog_base'
    where s.set_code = target.set_code and s.language = 'FR';

    if generic_count <> 0 and generic_count <> target.expected_count then
      raise exception 'Expected generic tracking rows for all % cards in %; found %', target.expected_count, target.set_code, generic_count;
    end if;
  end loop;

  select count(*) into missing_images
  from public.card_sets s
  join public.cards c on c.card_set_id = s.id
  where s.language = 'FR'
    and (coalesce(s.series_name, '') ilike '%mcdonald%' or s.set_name ilike '%mcdonald%')
    and coalesce(nullif(trim(c.image_url), ''), nullif(trim(c.image_source_url), '')) is null;
  if missing_images > 0 then
    raise exception 'Found % French McDonald''s cards without a usable image URL', missing_images;
  end if;

  if (select count(*) from public.cards c join public.card_sets s on s.id = c.card_set_id
      where s.set_code = '2018sm-fr' and s.language = 'FR'
        and c.collector_number ~ '^[0-9]+$' and c.collector_number::integer between 1 and 40) <> 40
     or (select count(distinct c.collector_number) from public.cards c join public.card_sets s on s.id = c.card_set_id
      where s.set_code = '2018sm-fr' and s.language = 'FR'
        and c.collector_number ~ '^[0-9]+$' and c.collector_number::integer between 1 and 40) <> 40 then
    raise exception 'French McDonald''s 2018 must contain exactly cards 1 through 40';
  end if;

  if (select count(*) from public.cards c join public.card_sets s on s.id = c.card_set_id
      where s.set_code = '2019sm-fr' and s.language = 'FR'
        and c.collector_number ~ '^[0-9]+$' and c.collector_number::integer between 1 and 40) <> 40
     or (select count(distinct c.collector_number) from public.cards c join public.card_sets s on s.id = c.card_set_id
      where s.set_code = '2019sm-fr' and s.language = 'FR'
        and c.collector_number ~ '^[0-9]+$' and c.collector_number::integer between 1 and 40) <> 40
     or not exists (select 1 from public.cards c join public.card_sets s on s.id = c.card_set_id
      where s.set_code = '2019sm-fr' and s.language = 'FR' and lower(c.collector_number) = '33b') then
    raise exception 'French McDonald''s 2019 must contain cards 1 through 40 and the distinct 33b print';
  end if;
end;
$$;

-- TCGdex's French 2018 import has the 38/40 name wrong; the French card list
-- identifies that number as Ponchiot. The numbered artwork URL remains attached.
update public.cards c
set card_name = 'Ponchiot'
from public.card_sets s
where s.id = c.card_set_id
  and s.set_code = '2018sm-fr'
  and s.language = 'FR'
  and c.collector_number = '38'
  and c.card_name = 'Passerouge';

do $$
begin
  if not exists (
    select 1 from public.cards c join public.card_sets s on s.id = c.card_set_id
    where s.set_code = '2018sm-fr' and s.language = 'FR'
      and c.collector_number = '38' and c.card_name = 'Ponchiot'
  ) then
    raise exception 'French McDonald''s 2018 card 38 must be Ponchiot';
  end if;
end;
$$;

-- 2018: all 40 cards exist in standard and confetti reverse-holo versions.
update public.card_print_variants v
set variant_key = 'standard', variant_label = 'Normale', finish_code = 'normal', checklist_group = 'main'
from public.cards c join public.card_sets s on s.id = c.card_set_id
where v.card_id = c.id and v.variant_key = 'catalog_base'
  and s.set_code = '2018sm-fr' and s.language = 'FR';

insert into public.card_print_variants
  (card_id, variant_key, variant_label, finish_code, checklist_group, is_master_set_target)
select c.id, 'holo_confetti', 'Reverse holographique confettis', 'reverse', 'main', true
from public.cards c join public.card_sets s on s.id = c.card_set_id
where s.set_code = '2018sm-fr' and s.language = 'FR'
on conflict (card_id, variant_key) do update set
  variant_label = excluded.variant_label, finish_code = excluded.finish_code,
  checklist_group = excluded.checklist_group, is_master_set_target = excluded.is_master_set_target;

-- 2019: both standard and reverse-holo versions, including the distinct 33b print.
update public.card_print_variants v
set variant_key = 'standard', variant_label = 'Normale', finish_code = 'normal', checklist_group = 'main'
from public.cards c join public.card_sets s on s.id = c.card_set_id
where v.card_id = c.id and v.variant_key = 'catalog_base'
  and s.set_code = '2019sm-fr' and s.language = 'FR';

insert into public.card_print_variants
  (card_id, variant_key, variant_label, finish_code, checklist_group, is_master_set_target)
select c.id, 'holo_confetti', 'Reverse holographique confettis', 'reverse', 'main', true
from public.cards c join public.card_sets s on s.id = c.card_set_id
where s.set_code = '2019sm-fr' and s.language = 'FR'
on conflict (card_id, variant_key) do update set
  variant_label = excluded.variant_label, finish_code = excluded.finish_code,
  checklist_group = excluded.checklist_group, is_master_set_target = excluded.is_master_set_target;

-- 2021: every card exists in standard and reverse-holo form.
update public.card_print_variants v
set variant_key = 'standard', variant_label = 'Normale', finish_code = 'normal', checklist_group = 'main'
from public.cards c join public.card_sets s on s.id = c.card_set_id
where v.card_id = c.id and v.variant_key = 'catalog_base'
  and s.set_code = '2021swsh' and s.language = 'FR';

insert into public.card_print_variants
  (card_id, variant_key, variant_label, finish_code, checklist_group, is_master_set_target)
select c.id, 'reverse_holo', 'Reverse holographique', 'reverse', 'main', true
from public.cards c join public.card_sets s on s.id = c.card_set_id
where s.set_code = '2021swsh' and s.language = 'FR'
on conflict (card_id, variant_key) do update set
  variant_label = excluded.variant_label, finish_code = excluded.finish_code,
  checklist_group = excluded.checklist_group, is_master_set_target = excluded.is_master_set_target;

-- 2022: only the six highlighted cards have a holo print; the rest are normal.
update public.card_print_variants v
set variant_key = case when c.collector_number in ('2','3','4','5','7','15') then 'holo' else 'standard' end,
    variant_label = case when c.collector_number in ('2','3','4','5','7','15') then 'Holo' else 'Normale' end,
    finish_code = case when c.collector_number in ('2','3','4','5','7','15') then 'holo' else 'normal' end,
    checklist_group = 'main'
from public.cards c join public.card_sets s on s.id = c.card_set_id
where v.card_id = c.id and v.variant_key = 'catalog_base'
  and s.set_code = '2022swsh' and s.language = 'FR';

-- 2023: the six holo cards are 1, 2, 3, 5, 6 and 11.
update public.card_print_variants v
set variant_key = case when c.collector_number in ('1','2','3','5','6','11') then 'holo' else 'standard' end,
    variant_label = case when c.collector_number in ('1','2','3','5','6','11') then 'Holo confettis' else 'Normale' end,
    finish_code = case when c.collector_number in ('1','2','3','5','6','11') then 'holo' else 'normal' end,
    checklist_group = 'main'
from public.cards c join public.card_sets s on s.id = c.card_set_id
where v.card_id = c.id and v.variant_key = 'catalog_base'
  and s.set_code = '2023sv' and s.language = 'FR';

-- 2024: the seven holo cards are 2, 3, 8, 10, 11, 12 and 15.
update public.card_print_variants v
set variant_key = case when c.collector_number in ('2','3','8','10','11','12','15') then 'holo' else 'standard' end,
    variant_label = case when c.collector_number in ('2','3','8','10','11','12','15') then 'Holo confettis' else 'Normale' end,
    finish_code = case when c.collector_number in ('2','3','8','10','11','12','15') then 'holo' else 'normal' end,
    checklist_group = 'main'
from public.cards c join public.card_sets s on s.id = c.card_set_id
where v.card_id = c.id and v.variant_key = 'catalog_base'
  and s.set_code = '2024sv' and s.language = 'FR';

do $$
declare
  expected_variants jsonb := '{
    "2018sm-fr": 80,
    "2019sm-fr": 82,
    "2021swsh": 50,
    "2022swsh": 15,
    "2023sv": 15,
    "2024sv": 15
  }'::jsonb;
  target record;
  actual_count integer;
begin
  for target in select key as set_code, value::text::integer as expected_count
    from jsonb_each(expected_variants)
  loop
    select count(*) into actual_count
    from public.card_print_variants v
    join public.cards c on c.id = v.card_id
    join public.card_sets s on s.id = c.card_set_id
    where s.set_code = target.set_code and s.language = 'FR'
      and v.is_master_set_target;

    if actual_count <> target.expected_count then
      raise exception 'Expected % tracked prints in French McDonald''s %; found %', target.expected_count, target.set_code, actual_count;
    end if;
  end loop;
end;
$$;

update public.card_sets s
set checklist_scope_note = case s.set_code
  when '2018sm-fr' then '40 cartes répertoriées, chacune suivie en version normale et reverse holographique confettis.'
  when '2019sm-fr' then '40 numéros imprimés, avec l’impression distincte 33b conservée. Les entrées sont suivies en version normale et reverse holographique confettis.'
  when '2021swsh' then '25 cartes, chacune suivie en version normale et reverse holographique.'
  when '2022swsh' then '15 cartes. Versions holographiques sur les cartes 2, 3, 4, 5, 7 et 15 ; les autres sont en version normale.'
  when '2023sv' then '15 cartes. Versions holographiques confettis sur les cartes 1, 2, 3, 5, 6 et 11 ; les autres sont en version normale.'
  when '2024sv' then '15 cartes. Versions holographiques confettis sur les cartes 2, 3, 8, 10, 11, 12 et 15 ; les autres sont en version normale.'
  else s.checklist_scope_note
end
where s.language = 'FR'
  and s.set_code in ('2018sm-fr','2019sm-fr','2021swsh','2022swsh','2023sv','2024sv');

commit;
