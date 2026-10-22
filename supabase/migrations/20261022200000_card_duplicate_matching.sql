-- Automatic, consent-based matching of surplus raw card copies.
-- This stores consent only; collection_cards remains the source of truth.

create table if not exists public.card_exchange_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  consent_version text not null default 'card-exchange-v1-2026-10-22',
  updated_at timestamptz not null default now()
);

alter table public.card_exchange_consents enable row level security;
revoke all on public.card_exchange_consents from public, anon, authenticated;
grant all on public.card_exchange_consents to service_role;

create or replace function public.get_card_exchange_status()
returns table (enabled boolean, active boolean, surplus_copies integer)
language sql
stable
security definer
set search_path = ''
as $$
  with actor as (
    select (select auth.uid()) as user_id
  ), buckets as (
    select
      cc.card_print_variant_id,
      coalesce(cc.edition_language_code, 'FR') as language_code,
      coalesce(cc.edition_market_code, 'FR') as market_code,
      coalesce(cc.edition_set_name, cs.set_name) as set_name,
      coalesce(cc.edition_collector_number, c.collector_number) as collector_number,
      count(*)::integer as copy_count
    from actor a
    join public.collection_cards cc on cc.user_id = a.user_id
    join public.collection_profiles cp
      on cp.id = cc.collection_profile_id
      and cp.manager_user_id = a.user_id
      and cp.profile_type = 'personal'
    join public.card_print_variants v on v.id = cc.card_print_variant_id
    join public.cards c on c.id = v.card_id
    join public.card_sets cs on cs.id = c.card_set_id
    where cc.ownership_type = 'raw'
    group by cc.card_print_variant_id,
      coalesce(cc.edition_language_code, 'FR'),
      coalesce(cc.edition_market_code, 'FR'),
      coalesce(cc.edition_set_name, cs.set_name),
      coalesce(cc.edition_collector_number, c.collector_number)
  )
  select
    coalesce(consent.enabled, false),
    coalesce(consent.enabled, false) and public.social_access_allowed(),
    coalesce((select sum(greatest(b.copy_count - 1, 0))::integer from buckets b), 0)
  from actor a
  left join public.card_exchange_consents consent on consent.user_id = a.user_id
  where a.user_id is not null;
$$;
revoke all on function public.get_card_exchange_status() from public, anon;
grant execute on function public.get_card_exchange_status() to authenticated;

create or replace function public.set_card_exchange_consent(p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'Connecte-toi pour gérer le partage de tes doubles.' using errcode = '42501';
  end if;
  if p_enabled is null then
    raise exception 'Choisis si tu souhaites proposer tes doubles.' using errcode = '22023';
  end if;
  if p_enabled and not public.social_access_allowed() then
    raise exception 'Active d’abord ton consentement aux fonctions sociales.' using errcode = '42501';
  end if;

  insert into public.card_exchange_consents (user_id, enabled, consent_version, updated_at)
  values (actor, p_enabled, 'card-exchange-v1-2026-10-22', now())
  on conflict (user_id) do update
    set enabled = excluded.enabled,
        consent_version = excluded.consent_version,
        updated_at = excluded.updated_at;
  return p_enabled;
end;
$$;
revoke all on function public.set_card_exchange_consent(boolean) from public, anon;
grant execute on function public.set_card_exchange_consent(boolean) to authenticated;

create or replace function public.find_card_exchange_matches(
  p_catalog_set_id uuid,
  p_language_code text,
  p_market_code text,
  p_foreign_set_id uuid default null
)
returns table (
  card_print_variant_id uuid,
  card_name text,
  collector_number text,
  variant_label text,
  image_url text,
  language_code text,
  set_name text,
  offered_by text,
  available_copies integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'Connecte-toi pour rechercher des doubles.' using errcode = '42501';
  end if;
  if not public.social_access_allowed() then
    raise exception 'Les fonctions sociales ne sont pas activées.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.card_exchange_consents own_consent
    where own_consent.user_id = actor and own_consent.enabled
  ) then
    raise exception 'Active le consentement au partage des doubles dans ton profil.' using errcode = '42501';
  end if;

  return query
  with target_printings as (
    select
      v.id as variant_id,
      c.id as catalog_card_id,
      c.card_name as display_name,
      c.collector_number as print_number,
      v.variant_label,
      coalesce(v.image_url, c.image_url) as print_image,
      'FR'::text as print_language,
      'FR'::text as print_market,
      cs.set_name as print_set_name
    from public.card_sets cs
    join public.cards c on c.card_set_id = cs.id
    join public.card_print_variants v on v.card_id = c.id
    where p_foreign_set_id is null
      and p_language_code = 'FR'
      and p_market_code = 'FR'
      and cs.id = p_catalog_set_id
      and cs.language = 'FR'
      and cs.is_public
      and v.is_master_set_target

    union all

    select
      v.id as variant_id,
      c.id as catalog_card_id,
      fcp.card_name as display_name,
      fcp.collector_number as print_number,
      v.variant_label,
      coalesce(fcp.image_url, v.image_url, c.image_url) as print_image,
      fcs.language_code as print_language,
      fcs.market_code as print_market,
      fcs.set_name as print_set_name
    from public.foreign_card_sets fcs
    join public.foreign_card_printings fcp
      on fcp.foreign_set_id = fcs.id
      and fcp.validation_status = 'verified'
    join public.cards c on c.id = fcp.catalog_card_id
    join public.card_print_variants v
      on v.card_id = c.id
      and v.is_master_set_target
      and v.variant_key = any(fcp.variant_keys)
    where p_foreign_set_id is not null
      and fcs.id = p_foreign_set_id
      and fcs.catalog_set_id = p_catalog_set_id
      and fcs.validation_status = 'verified'
      and fcs.language_code = p_language_code
      and fcs.market_code = p_market_code
  ), missing_printings as (
    select t.*
    from target_printings t
    where not exists (
      select 1
      from public.collection_cards owned
      join public.collection_profiles own_profile
        on own_profile.id = owned.collection_profile_id
        and own_profile.manager_user_id = actor
        and own_profile.profile_type = 'personal'
      where owned.user_id = actor
        and owned.ownership_type = 'raw'
        and owned.card_print_variant_id = t.variant_id
        and coalesce(owned.edition_language_code, 'FR') = t.print_language
        and coalesce(owned.edition_market_code, 'FR') = t.print_market
        and coalesce(owned.edition_set_name, (
          select base_set.set_name
          from public.cards base_card
          join public.card_sets base_set on base_set.id = base_card.card_set_id
          where base_card.id = t.catalog_card_id
        )) = t.print_set_name
        and coalesce(owned.edition_collector_number, (
          select base_card.collector_number
          from public.cards base_card
          where base_card.id = t.catalog_card_id
        )) = t.print_number
    )
  ), consenting_members as (
    select consent.user_id
    from public.card_exchange_consents consent
    join public.social_access_consents social on social.user_id = consent.user_id
    where consent.enabled
      and (
        (social.age_band = '15_or_over' and social.consented_at is not null)
        or (social.age_band = 'under_15'
          and social.consented_at is not null
          and social.parent_consented_at is not null
          and social.child_assented_at is not null)
      )
      and consent.user_id <> actor
  )
  select
    t.variant_id,
    t.display_name,
    t.print_number,
    t.variant_label,
    t.print_image,
    t.print_language,
    t.print_set_name,
    p.display_name,
    count(*)::integer as copies
  from missing_printings t
  join public.collection_cards cc
    on cc.card_print_variant_id = t.variant_id
    and cc.ownership_type = 'raw'
    and coalesce(cc.edition_language_code, 'FR') = t.print_language
    and coalesce(cc.edition_market_code, 'FR') = t.print_market
    and coalesce(cc.edition_set_name, (
      select base_set.set_name
      from public.cards base_card
      join public.card_sets base_set on base_set.id = base_card.card_set_id
      where base_card.id = t.catalog_card_id
    )) = t.print_set_name
    and coalesce(cc.edition_collector_number, (
      select base_card.collector_number
      from public.cards base_card
      where base_card.id = t.catalog_card_id
    )) = t.print_number
  join public.collection_profiles cp
    on cp.id = cc.collection_profile_id
    and cp.manager_user_id = cc.user_id
    and cp.profile_type = 'personal'
  join consenting_members consenting on consenting.user_id = cc.user_id
  join public.profiles p on p.id = cc.user_id
  group by t.variant_id, t.display_name, t.print_number, t.variant_label,
    t.print_image, t.print_language, t.print_set_name, p.display_name
  having count(*) > 1
  order by t.print_number, t.display_name, p.display_name
  limit 250;
end;
$$;
revoke all on function public.find_card_exchange_matches(uuid, text, text, uuid) from public, anon;
grant execute on function public.find_card_exchange_matches(uuid, text, text, uuid) to authenticated;
