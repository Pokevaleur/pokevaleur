-- Use the published French set abbreviations while leaving card and collection
-- IDs untouched. The Classic Collection uses the distinct code 30CC.
do $$
begin
  if exists (
    select 1 from public.card_sets
    where language = 'FR' and set_code = '30C' and set_name <> '30ᵉ Anniversaire'
  ) then
    raise exception 'French set code 30C is already used by another set';
  end if;

  if exists (
    select 1 from public.card_sets
    where language = 'FR' and set_code = '30CC' and set_name <> 'Collection Classique30ᵉ Anniversaire'
  ) then
    raise exception 'French set code 30CC is already used by another set';
  end if;

  update public.card_sets
  set set_code = '30C'
  where language = 'FR'
    and set_code = '30th'
    and set_name = '30ᵉ Anniversaire';

  update public.card_sets
  set set_code = '30CC'
  where language = 'FR'
    and set_code = '30th-c'
    and set_name = 'Collection Classique30ᵉ Anniversaire';

  if not exists (
    select 1 from public.card_sets
    where language = 'FR' and set_code = '30C' and set_name = '30ᵉ Anniversaire'
  ) then
    raise exception 'French 30C set could not be verified after renaming';
  end if;

  if not exists (
    select 1 from public.card_sets
    where language = 'FR' and set_code = '30CC' and set_name = 'Collection Classique30ᵉ Anniversaire'
  ) then
    raise exception 'French 30CC set could not be verified after renaming';
  end if;
end;
$$;
