-- Add the 10 Ultra Master printings documented in the supplied SL09 sheet.
-- Keep them separate from the 339-card Master target. This is insert-only for
-- catalog rows: no collection card or existing print variant is updated.
begin;

do $$
declare
  target_set_id uuid;
begin
  select id into target_set_id
  from public.card_sets
  where lower(set_code) = 'sm9' and language = 'FR'
  limit 1;

  if target_set_id is null then
    raise exception 'French SM9 / Duo de Choc card set was not found';
  end if;

  if (select count(*) from public.cards where card_set_id = target_set_id) <> 196 then
    raise exception 'Unexpected Duo de Choc catalog size; refusing to add Ultra Master rows';
  end if;
end;
$$;

-- 152b is a separate alternative-numbered Communication Pokémon printing.
insert into public.cards (
  card_set_id, collector_number, card_name, card_type, rarity_label,
  guide_order, source_url
)
select
  s.id, '152b', 'Communication Pokémon', 'Dresseur', 'Peu commune',
  152, 'https://www.pokepedia.fr/Communication_Pok%C3%A9mon_%28Soleil_et_Lune_Duo_de_Choc_152b%29'
from public.card_sets s
where lower(s.set_code) = 'sm9' and s.language = 'FR'
on conflict (card_set_id, collector_number) do nothing;

-- Promo printings shown by their colored boxes in the Ultra Master checklist.
-- The two Academy slots are kept separate because the source checklist counts
-- two impressions, without giving them different names.
insert into public.card_print_variants (
  card_id, variant_key, variant_label, finish_code, guide_marker,
  checklist_group, is_master_set_target
)
select
  c.id, p.variant_key, p.variant_label, p.finish_code, p.guide_marker,
  'ultra_master', false
from public.cards c
join public.card_sets s on s.id = c.card_set_id
join (values
  ('14', 'cosmos_holo_promo', 'Holo Cosmos promo', 'cosmos_holo', null::text),
  ('14', 'cracked_ice_holo_promo', 'Holo Cracked Ice promo', 'cracked_ice_holo', null::text),
  ('19', 'holo_promo_duo_de_choc_stamp', 'Holo promo tampon Duo de Choc', 'holo_promo', 'Duo de Choc'),
  ('25', 'cracked_ice_holo_promo', 'Holo Cracked Ice promo', 'cracked_ice_holo', null::text),
  ('40', 'non_holo_promo', 'Promo non holographique', 'non_holo_promo', null::text),
  ('45', 'academy_combat_v1_pikachu_1', 'Académie de Combat V1 — Deck Pikachu (impression 1)', 'non_holo_promo', 'Académie de Combat V1'),
  ('45', 'academy_combat_v1_pikachu_2', 'Académie de Combat V1 — Deck Pikachu (impression 2)', 'non_holo_promo', 'Académie de Combat V1'),
  ('99', 'non_holo_promo', 'Promo non holographique', 'non_holo_promo', null::text),
  ('140', 'non_holo_promo', 'Promo non holographique', 'non_holo_promo', null::text),
  ('152b', 'non_holo_promo', 'Promo non holographique', 'non_holo_promo', null::text)
) as p(collector_number, variant_key, variant_label, finish_code, guide_marker)
  on c.collector_number = p.collector_number
where lower(s.set_code) = 'sm9'
  and s.language = 'FR'
on conflict (card_id, variant_key) do nothing;

-- Preserve prior scope text and document the added checklist scope.
update public.card_sets s
set checklist_scope_note = concat_ws(
  ' ',
  nullif(trim(s.checklist_scope_note), ''),
  'Checklist Ultra Master SL09 issue du PDF fourni : 10 impressions supplémentaires cataloguées hors cible Master (4 promos non holographiques, 1 holo tamponnée Duo de Choc, 2 Cracked Ice, 1 Cosmos Holo et 2 impressions Académie de Combat V1). La carte 152b Communication Pokémon est ajoutée comme entrée alternative distincte.'
)
where lower(s.set_code) = 'sm9'
  and s.language = 'FR'
  and position('10 impressions supplémentaires cataloguées hors cible Master' in coalesce(s.checklist_scope_note, '')) = 0;

do $$
declare
  target_set_id uuid;
  ultra_count integer;
  master_count integer;
begin
  select id into target_set_id from public.card_sets
  where lower(set_code) = 'sm9' and language = 'FR' limit 1;

  select count(*) into ultra_count
  from public.card_print_variants v
  join public.cards c on c.id = v.card_id
  where c.card_set_id = target_set_id and v.checklist_group = 'ultra_master';

  select count(*) into master_count
  from public.card_print_variants v
  join public.cards c on c.id = v.card_id
  where c.card_set_id = target_set_id and v.is_master_set_target;

  if ultra_count <> 10 then
    raise exception 'Expected 10 Ultra Master promo impressions, found %', ultra_count;
  end if;
  if master_count <> 339 then
    raise exception 'Master target changed unexpectedly; expected 339, found %', master_count;
  end if;
end;
$$;

commit;
