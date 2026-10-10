create table if not exists public.user_activity_events (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_key bigint not null default pg_catalog.txid_current(),
  event_type text not null check (event_type in (
    'card_added', 'card_removed', 'card_updated',
    'sealed_added', 'sealed_removed', 'sealed_quantity_changed',
    'collection_created', 'collection_deleted'
  )),
  entity_type text not null check (entity_type in ('card', 'sealed_product', 'collection')),
  entity_id uuid,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default pg_catalog.now()
);

create index if not exists user_activity_events_user_created_idx
  on public.user_activity_events(user_id, created_at desc);

alter table public.user_activity_events enable row level security;
revoke all on table public.user_activity_events from public, anon, authenticated;

create or replace function public.capture_collection_card_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid;
  v_profile_id uuid;
  v_variant_id uuid;
  v_entity_id uuid;
  v_event text;
  v_summary jsonb;
  v_profile_name text;
begin
  if tg_op = 'INSERT' then
    v_user_id := new.user_id;
    v_profile_id := new.collection_profile_id;
    v_variant_id := new.card_print_variant_id;
    v_entity_id := new.card_print_variant_id;
    v_event := 'card_added';
  elsif tg_op = 'DELETE' then
    v_user_id := old.user_id;
    v_profile_id := old.collection_profile_id;
    v_variant_id := old.card_print_variant_id;
    v_entity_id := old.card_print_variant_id;
    v_event := 'card_removed';
  else
    if new.card_print_variant_id is not distinct from old.card_print_variant_id
       and new.collection_profile_id is not distinct from old.collection_profile_id
       and new.ownership_type is not distinct from old.ownership_type
       and new.raw_condition is not distinct from old.raw_condition then
      return new;
    end if;
    v_user_id := new.user_id;
    v_profile_id := new.collection_profile_id;
    v_variant_id := new.card_print_variant_id;
    v_entity_id := new.card_print_variant_id;
    v_event := 'card_updated';
  end if;

  if v_user_id is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  select cp.display_name into v_profile_name
    from public.collection_profiles cp where cp.id = v_profile_id;

  select pg_catalog.jsonb_build_object(
    'series', cs.set_name,
    'series_code', cs.set_code,
    'card', c.card_name,
    'number', c.collector_number,
    'variant', v.variant_label,
    'collection', v_profile_name,
    'quantity', 1,
    'changed_fields', case when tg_op = 'UPDATE' then pg_catalog.to_jsonb(pg_catalog.array_remove(array[
      case when new.card_print_variant_id is distinct from old.card_print_variant_id then 'carte ou variante' end,
      case when new.collection_profile_id is distinct from old.collection_profile_id then 'collection' end,
      case when new.ownership_type is distinct from old.ownership_type then 'type de possession' end,
      case when new.raw_condition is distinct from old.raw_condition then 'état' end
    ]::text[], null::text)) else '[]'::jsonb end
  ) into v_summary
  from public.card_print_variants v
  join public.cards c on c.id = v.card_id
  join public.card_sets cs on cs.id = c.card_set_id
  where v.id = v_variant_id;

  insert into public.user_activity_events(user_id, event_type, entity_type, entity_id, summary)
  values (v_user_id, v_event, 'card', v_entity_id, coalesce(v_summary, '{}'::jsonb));

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists capture_collection_card_activity on public.collection_cards;
create trigger capture_collection_card_activity
after insert or update or delete on public.collection_cards
for each row execute function public.capture_collection_card_activity();

create or replace function public.capture_collection_item_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid;
  v_profile_id uuid;
  v_product_id uuid;
  v_event text;
  v_quantity integer;
  v_summary jsonb;
  v_profile_name text;
  v_product_name text;
  v_product_series text;
begin
  if tg_op = 'INSERT' then
    v_user_id := new.user_id;
    v_profile_id := new.collection_profile_id;
    v_product_id := new.product_id;
    v_event := 'sealed_added';
    v_quantity := new.quantity;
  elsif tg_op = 'DELETE' then
    v_user_id := old.user_id;
    v_profile_id := old.collection_profile_id;
    v_product_id := old.product_id;
    v_event := 'sealed_removed';
    v_quantity := old.quantity;
  else
    if new.quantity is not distinct from old.quantity then
      return new;
    end if;
    v_user_id := new.user_id;
    v_profile_id := new.collection_profile_id;
    v_product_id := new.product_id;
    v_event := 'sealed_quantity_changed';
    v_quantity := new.quantity;
  end if;

  if v_user_id is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  select cp.display_name into v_profile_name
    from public.collection_profiles cp where cp.id = v_profile_id;
  select p.name, p.series into v_product_name, v_product_series
    from public.products p where p.id = v_product_id;

  v_summary := pg_catalog.jsonb_build_object(
    'product', v_product_name,
    'series', v_product_series,
    'collection', v_profile_name,
    'quantity', v_quantity,
    'quantity_before', case when tg_op = 'UPDATE' then old.quantity end,
    'quantity_after', case when tg_op = 'UPDATE' then new.quantity end
  );

  insert into public.user_activity_events(user_id, event_type, entity_type, entity_id, summary)
  values (v_user_id, v_event, 'sealed_product', v_product_id, v_summary);

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists capture_collection_item_activity on public.collection_items;
create trigger capture_collection_item_activity
after insert or update or delete on public.collection_items
for each row execute function public.capture_collection_item_activity();

create or replace function public.capture_collection_profile_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid;
  v_event text;
  v_profile public.collection_profiles%rowtype;
begin
  if tg_op = 'DELETE' then
    v_profile := old;
    v_event := 'collection_deleted';
  else
    v_profile := new;
    v_event := 'collection_created';
  end if;

  v_user_id := v_profile.manager_user_id;
  if v_user_id is not null then
    insert into public.user_activity_events(user_id, event_type, entity_type, entity_id, summary)
    values (
      v_user_id,
      v_event,
      'collection',
      v_profile.id,
      pg_catalog.jsonb_build_object('collection', v_profile.display_name, 'type', v_profile.profile_type)
    );
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists capture_collection_profile_activity on public.collection_profiles;
create trigger capture_collection_profile_activity
after insert or delete on public.collection_profiles
for each row execute function public.capture_collection_profile_activity();

create or replace function public.admin_user_overview()
returns table(accounts_total bigint, accounts_last_7_days bigint, active_last_30_days bigint)
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin is true
  ) then
    raise exception 'Accès réservé à l’administration.' using errcode = '42501';
  end if;

  return query
    select
      count(*)::bigint,
      count(*) filter (where u.created_at >= pg_catalog.now() - interval '7 days')::bigint,
      count(*) filter (where u.last_sign_in_at >= pg_catalog.now() - interval '30 days')::bigint
    from auth.users u;
end;
$$;

create or replace function public.admin_list_users(
  p_limit integer default 50,
  p_offset integer default 0,
  p_search text default null
)
returns table(
  user_id uuid,
  email text,
  display_name text,
  account_created_at timestamptz,
  last_sign_in_at timestamptz,
  collection_count bigint,
  card_copy_count bigint,
  sealed_quantity bigint,
  total_count bigint
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin is true
  ) then
    raise exception 'Accès réservé à l’administration.' using errcode = '42501';
  end if;

  return query
  with matching as (
    select u.id, u.email::text as email, p.display_name, u.created_at, u.last_sign_in_at
    from auth.users u
    left join public.profiles p on p.id = u.id
    where p_search is null or pg_catalog.btrim(p_search) = ''
       or u.email ilike '%' || pg_catalog.btrim(p_search) || '%'
       or p.display_name ilike '%' || pg_catalog.btrim(p_search) || '%'
  )
  select
    m.id,
    m.email,
    m.display_name,
    m.created_at,
    m.last_sign_in_at,
    coalesce(cp.collection_count, 0)::bigint,
    coalesce(cc.card_copy_count, 0)::bigint,
    coalesce(ci.sealed_quantity, 0)::bigint,
    count(*) over ()::bigint
  from matching m
  left join lateral (
    select count(*) as collection_count
    from public.collection_profiles x where x.manager_user_id = m.id
  ) cp on true
  left join lateral (
    select count(*) as card_copy_count
    from public.collection_cards x
    join public.collection_profiles y on y.id = x.collection_profile_id
    where y.manager_user_id = m.id
  ) cc on true
  left join lateral (
    select coalesce(sum(x.quantity), 0) as sealed_quantity
    from public.collection_items x
    join public.collection_profiles y on y.id = x.collection_profile_id
    where y.manager_user_id = m.id
  ) ci on true
  order by m.created_at desc, m.id
  limit greatest(1, least(coalesce(p_limit, 50), 100))
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_user_activity(p_user_id uuid, p_limit integer default 100)
returns table(event_id uuid, occurred_at timestamptz, transaction_key bigint, event_type text, entity_type text, entity_id uuid, summary jsonb)
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin is true
  ) then
    raise exception 'Accès réservé à l’administration.' using errcode = '42501';
  end if;

  return query
    select e.id, e.created_at, e.transaction_key, e.event_type, e.entity_type, e.entity_id, e.summary
    from public.user_activity_events e
    where e.user_id = p_user_id
    order by e.created_at desc, e.id desc
    limit greatest(1, least(coalesce(p_limit, 100), 200));
end;
$$;

revoke all on function public.capture_collection_card_activity() from public, anon, authenticated;
revoke all on function public.capture_collection_item_activity() from public, anon, authenticated;
revoke all on function public.capture_collection_profile_activity() from public, anon, authenticated;
revoke all on function public.admin_user_overview() from public, anon;
revoke all on function public.admin_list_users(integer, integer, text) from public, anon;
revoke all on function public.admin_user_activity(uuid, integer) from public, anon;
grant execute on function public.admin_user_overview() to authenticated;
grant execute on function public.admin_list_users(integer, integer, text) to authenticated;
grant execute on function public.admin_user_activity(uuid, integer) to authenticated;
