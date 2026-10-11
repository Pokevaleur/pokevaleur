-- The French 30th Anniversary checklists are all foil and do not have reverse
-- holo prints. Replace the generic catalog tracking row with the actual finish,
-- keeping the existing row IDs so collection ownership remains attached.
-- Source: https://www.tcgplayer.com/content/article/Collector-s-Guide-to-Pok%C3%A9mon-TCG-30th-Celebration/bac99231-4293-4373-af64-6f5ed0d5735d/

do $$
declare
  target record;
  target_set_id uuid;
  actual_cards integer;
begin
  for target in
    select * from (values
      ('30th'::text, 158, 'Holo'::text),
      ('30th-c'::text, 30, 'Holo · tampon 30ᵉ Anniversaire'::text)
    ) as expected(set_code, card_count, variant_label)
  loop
    select id into target_set_id
    from public.card_sets
    where set_code = target.set_code and language = 'FR'
    limit 1;

    if target_set_id is null then
      raise exception 'French card set % was not found', target.set_code;
    end if;

    select count(*)::integer into actual_cards
    from public.cards
    where card_set_id = target_set_id;

    if actual_cards <> target.card_count then
      raise exception 'Expected % cards in %, found %', target.card_count, target.set_code, actual_cards;
    end if;

    update public.card_print_variants v
    set variant_key = 'holo',
        variant_label = target.variant_label,
        finish_code = 'holo'
    from public.cards c
    where c.card_set_id = target_set_id
      and v.card_id = c.id
      and v.variant_key = 'catalog_base';

    insert into public.card_print_variants (
      card_id,
      variant_key,
      variant_label,
      finish_code,
      checklist_group,
      is_master_set_target
    )
    select
      c.id,
      'holo',
      target.variant_label,
      'holo',
      'main',
      true
    from public.cards c
    where c.card_set_id = target_set_id
      and not exists (
        select 1
        from public.card_print_variants v
        where v.card_id = c.id and v.variant_key = 'holo'
      );

    select count(*)::integer into actual_cards
    from public.cards c
    join public.card_print_variants v on v.card_id = c.id
    where c.card_set_id = target_set_id
      and v.variant_key = 'holo'
      and v.finish_code = 'holo';

    if actual_cards <> target.card_count then
      raise exception 'Expected % Holo variants in %, found %', target.card_count, target.set_code, actual_cards;
    end if;
  end loop;
end;
$$;
