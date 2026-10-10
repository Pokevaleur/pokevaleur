do $$
declare
  target_set_id uuid;
begin
  select id into target_set_id
  from public.card_sets
  where lower(set_code) = 'swsh7' and language = 'FR'
  limit 1;

  if target_set_id is null then
    raise exception 'French EB07 / swsh7 card set was not found';
  end if;

  update public.card_print_variants v
  set
    variant_label = case
      when c.collector_number::integer between 1 and 165
        and c.rarity_label in ('Commune', 'Peu commune', 'Rare') then 'Normale'
      when c.collector_number::integer between 1 and 165 then 'Holo'
      else 'Carte'
    end,
    finish_code = case
      when c.collector_number::integer between 1 and 165
        and c.rarity_label in ('Commune', 'Peu commune', 'Rare') then 'normal'
      else 'holo'
    end,
    is_master_set_target = true,
    checklist_group = 'main'
  from public.cards c
  where v.card_id = c.id
    and c.card_set_id = target_set_id
    and v.variant_key = 'catalog_base';

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
    'reverse',
    'Reverse',
    'reverse',
    null,
    'main',
    true
  from public.cards c
  where c.card_set_id = target_set_id
    and c.collector_number::integer between 1 and 165
    and c.collector_number::integer <> all (array[
      7, 8, 13, 14, 18, 21, 28, 29, 30, 31, 40, 41, 48, 51, 58, 59,
      64, 65, 70, 74, 75, 83, 91, 92, 94, 95, 100, 101, 110, 111, 117, 122, 123
    ])
  on conflict (card_id, variant_key) do nothing;

  update public.card_sets
  set checklist_scope_note = 'Master Set vérifié : 203 cartes annoncées et 34 cartes secrètes, soit 237 cartes numérotées. La checklist officielle indique une version reverse pour 132 cartes de la série principale ; les cartes sans seconde case n’ont pas de reverse listée.'
  where id = target_set_id;
end;
$$;
