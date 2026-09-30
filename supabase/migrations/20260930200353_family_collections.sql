-- Family collections: a manager may maintain child collections until the
-- child accepts a one-time invitation. Existing account data stays personal.

create table if not exists public.collection_profiles (
  id uuid primary key default gen_random_uuid(),
  manager_user_id uuid not null references auth.users(id) on delete cascade,
  profile_type text not null check (profile_type in ('personal', 'child')),
  is_default boolean not null default false,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 32),
  avatar_key text not null default 'star'
    check (avatar_key in ('star', 'fire', 'water', 'leaf', 'spark', 'crystal')),
  created_at timestamptz not null default now(),
  transferred_at timestamptz
);
alter table public.collection_profiles add column if not exists is_default boolean not null default false;

-- Keep a transferred collection as a distinct collection owned by the child.
-- A user may therefore own their original collection plus claimed collections.
drop index if exists public.collection_profiles_one_personal_per_manager;
alter table public.collection_profiles drop constraint if exists collection_profiles_personal_name;
create unique index if not exists collection_profiles_one_default_per_manager
  on public.collection_profiles (manager_user_id) where is_default;
create unique index if not exists collection_profiles_child_name_per_manager
  on public.collection_profiles (manager_user_id, lower(btrim(display_name))) where profile_type = 'child';
create index if not exists collection_profiles_manager_idx
  on public.collection_profiles (manager_user_id, created_at);

insert into public.collection_profiles (manager_user_id, profile_type, is_default, display_name)
select u.id, 'personal', true, 'Ma collection'
from auth.users u
on conflict do nothing;

create or replace function public.create_personal_collection_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.collection_profiles (manager_user_id, profile_type, is_default, display_name)
  values (new.id, 'personal', true, 'Ma collection')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists create_personal_collection_profile_after_profile on public.profiles;
create trigger create_personal_collection_profile_after_profile
after insert on public.profiles
for each row execute function public.create_personal_collection_profile();

alter table public.collection_items
  add column if not exists collection_profile_id uuid references public.collection_profiles(id) on delete cascade;

update public.collection_items ci
set collection_profile_id = cp.id
from public.collection_profiles cp
where cp.manager_user_id = ci.user_id
  and cp.profile_type = 'personal'
  and ci.collection_profile_id is null;

alter table public.collection_items alter column collection_profile_id set not null;
create index if not exists collection_items_profile_created_idx
  on public.collection_items (collection_profile_id, created_at desc);
create index if not exists collection_items_photo_path_idx
  on public.collection_items (photo_path) where photo_path is not null;
create index if not exists collection_item_photos_item_id_idx
  on public.collection_item_photos (collection_item_id);
create index if not exists collection_item_photos_photo_path_idx
  on public.collection_item_photos (photo_path) where photo_path is not null;
create index if not exists collection_item_photos_user_id_idx
  on public.collection_item_photos (user_id);
create index if not exists booster_reference_contributions_item_idx
  on public.booster_reference_contributions (collection_item_id);
create index if not exists booster_reference_contributions_user_id_idx
  on public.booster_reference_contributions (user_id);

-- A linked image becomes readable by every manager of its collection. Only
-- allow clients to attach paths from their own Storage folder; an unchanged
-- legacy path remains valid when a transferred collection changes managers.
create or replace function public.validate_collection_image_path_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.photo_path is null or (select auth.uid()) is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.photo_path is not distinct from old.photo_path then
    return new;
  end if;
  if (storage.foldername(new.photo_path))[1] is distinct from (select auth.uid())::text then
    raise exception 'Les photos doivent provenir de ton espace de stockage.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists collection_items_photo_path_owner on public.collection_items;
create trigger collection_items_photo_path_owner
before insert or update of photo_path on public.collection_items
for each row execute function public.validate_collection_image_path_owner();

drop trigger if exists collection_item_photos_photo_path_owner on public.collection_item_photos;
create trigger collection_item_photos_photo_path_owner
before insert or update of photo_path on public.collection_item_photos
for each row execute function public.validate_collection_image_path_owner();

create or replace function public.collection_can_manage_profile(profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.collection_profiles cp
    where cp.id = profile_id and cp.manager_user_id = (select auth.uid())
  );

$$;

revoke all on function public.collection_can_manage_profile(uuid) from public, anon;
grant execute on function public.collection_can_manage_profile(uuid) to authenticated;

-- Serialize client writes by manager with collection transfers. The manager
-- advisory lock is acquired before PostgreSQL locks rows touched by the write.
create or replace function public.lock_collection_manager_for_write(manager_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  select pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('collection-manager:' || manager_id::text, 0)
  );
$$;
revoke all on function public.lock_collection_manager_for_write(uuid) from public, anon, authenticated, service_role;

create or replace function public.lock_managed_collection_manager_for_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is not null then
    perform public.lock_collection_manager_for_write(actor);
  end if;
  return null;
end;
$$;
revoke all on function public.lock_managed_collection_manager_for_write() from public, anon;
grant execute on function public.lock_managed_collection_manager_for_write() to authenticated, service_role;

drop trigger if exists lock_collection_manager_before_write on public.collection_profiles;
create trigger lock_collection_manager_before_write
before insert or update or delete on public.collection_profiles
for each statement execute function public.lock_managed_collection_manager_for_write();

drop trigger if exists lock_collection_manager_before_write on public.collection_items;
create trigger lock_collection_manager_before_write
before insert or update or delete on public.collection_items
for each statement execute function public.lock_managed_collection_manager_for_write();
drop trigger if exists lock_collection_manager_before_write on public.collection_item_photos;
create trigger lock_collection_manager_before_write
before insert or update or delete on public.collection_item_photos
for each statement execute function public.lock_managed_collection_manager_for_write();
drop trigger if exists lock_collection_manager_before_write on public.collection_item_boosters;
create trigger lock_collection_manager_before_write
before insert or update or delete on public.collection_item_boosters
for each statement execute function public.lock_managed_collection_manager_for_write();

create or replace function public.validate_child_collection_profile_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  current_manager uuid;
  current_type text;
begin
  if actor is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  select cp.manager_user_id, cp.profile_type into current_manager, current_type
  from public.collection_profiles cp
  where cp.id = old.id
  for share;
  if not found then
    raise exception 'Collection introuvable.' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    if current_manager is distinct from actor or current_type <> 'child' then
      raise exception 'Seul le gestionnaire peut supprimer cette collection enfant.' using errcode = '42501';
    end if;
    return old;
  end if;

  if current_manager = actor and current_type = 'child'
    and new.manager_user_id = actor and new.profile_type = 'child'
    and not new.is_default and new.transferred_at is null then
    return new;
  end if;

  -- The recipient-side SECURITY DEFINER transfer is the only supported
  -- change from a managed child profile to a personal collection.
  if current_type = 'child' and current_manager is distinct from actor
    and new.manager_user_id = actor and new.profile_type = 'personal'
    and not new.is_default and new.transferred_at is not null then
    return new;
  end if;

  raise exception 'Modification de collection refusée.' using errcode = '42501';
end;
$$;
revoke all on function public.validate_child_collection_profile_write() from public, anon;
grant execute on function public.validate_child_collection_profile_write() to authenticated, service_role;
drop trigger if exists validate_child_collection_profile_write on public.collection_profiles;
create trigger validate_child_collection_profile_write
before update or delete on public.collection_profiles
for each row execute function public.validate_child_collection_profile_write();

create or replace function public.validate_collection_item_manager()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_manager uuid;
begin
  select cp.manager_user_id into current_manager
  from public.collection_profiles cp
  where cp.id = new.collection_profile_id
  for share;
  if not found or current_manager is distinct from new.user_id then
    raise exception 'Le propriétaire de cet objet ne gère pas cette collection.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_collection_item_manager() from public, anon;
grant execute on function public.validate_collection_item_manager() to authenticated, service_role;
drop trigger if exists validate_collection_item_manager on public.collection_items;
create trigger validate_collection_item_manager
before insert or update on public.collection_items
for each row execute function public.validate_collection_item_manager();

create or replace function public.validate_collection_child_row_manager()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_manager uuid;
begin
  select cp.manager_user_id into current_manager
  from public.collection_items ci
  join public.collection_profiles cp on cp.id = ci.collection_profile_id
  where ci.id = new.collection_item_id
  for share of cp;
  if not found or current_manager is distinct from new.user_id then
    raise exception 'Le propriétaire de cet élément ne gère pas cette collection.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_collection_child_row_manager() from public, anon;
grant execute on function public.validate_collection_child_row_manager() to authenticated, service_role;
drop trigger if exists validate_collection_item_photo_manager on public.collection_item_photos;
create trigger validate_collection_item_photo_manager
before insert or update on public.collection_item_photos
for each row execute function public.validate_collection_child_row_manager();
drop trigger if exists validate_collection_item_booster_manager on public.collection_item_boosters;
create trigger validate_collection_item_booster_manager
before insert or update on public.collection_item_boosters
for each row execute function public.validate_collection_child_row_manager();

alter table public.collection_profiles enable row level security;
grant select, insert, update, delete on public.collection_profiles to authenticated;
drop policy if exists collection_profiles_read_managed on public.collection_profiles;
create policy collection_profiles_read_managed on public.collection_profiles
  for select to authenticated using (manager_user_id = (select auth.uid()));
drop policy if exists collection_profiles_create_child on public.collection_profiles;
create policy collection_profiles_create_child on public.collection_profiles
  for insert to authenticated with check (
    manager_user_id = (select auth.uid()) and profile_type = 'child'
      and is_default = false and transferred_at is null
  );
drop policy if exists collection_profiles_update_managed on public.collection_profiles;
create policy collection_profiles_update_managed on public.collection_profiles
  for update to authenticated using (
    manager_user_id = (select auth.uid()) and profile_type = 'child' and transferred_at is null
  ) with check (
    manager_user_id = (select auth.uid()) and profile_type = 'child'
      and is_default = false and transferred_at is null
  );
drop policy if exists collection_profiles_delete_child on public.collection_profiles;
create policy collection_profiles_delete_child on public.collection_profiles
  for delete to authenticated using (manager_user_id = (select auth.uid()) and profile_type = 'child');

drop policy if exists collection_read_own on public.collection_items;
drop policy if exists collection_insert_own on public.collection_items;
drop policy if exists collection_update_own on public.collection_items;
drop policy if exists collection_delete_own on public.collection_items;
create policy collection_items_read_managed on public.collection_items
  for select to authenticated using (public.collection_can_manage_profile(collection_profile_id));
create policy collection_items_insert_managed on public.collection_items
  for insert to authenticated with check (
    user_id = (select auth.uid()) and public.collection_can_manage_profile(collection_profile_id)
  );
create policy collection_items_update_managed on public.collection_items
  for update to authenticated using (public.collection_can_manage_profile(collection_profile_id))
  with check (user_id = (select auth.uid()) and public.collection_can_manage_profile(collection_profile_id));
create policy collection_items_delete_managed on public.collection_items
  for delete to authenticated using (public.collection_can_manage_profile(collection_profile_id));

-- Child collections do not satisfy the member thresholds for social features.
create or replace function public.community_can_post(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user = (select auth.uid())
    and (select count(*) from public.collection_items ci
      join public.collection_profiles cp on cp.id = ci.collection_profile_id
      where ci.user_id = p_user and cp.profile_type = 'personal') >= 10
    and not exists (
      select 1 from public.community_user_status s
      where s.user_id = p_user
        and s.suspended_until is not null
        and s.suspended_until > now()
    );
$$;
revoke all on function public.community_can_post(uuid) from public, anon;
grant execute on function public.community_can_post(uuid) to authenticated;

create or replace function public.trade_can_participate(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user = (select auth.uid())
    and (select count(*) from public.collection_items ci
      join public.collection_profiles cp on cp.id = ci.collection_profile_id
      where ci.user_id = p_user and cp.profile_type = 'personal') >= 10
    and not exists (
      select 1 from public.community_user_status s
      where s.user_id = p_user
        and s.suspended_until is not null
        and s.suspended_until > now()
    );
$$;
revoke all on function public.trade_can_participate(uuid) from public, anon;
grant execute on function public.trade_can_participate(uuid) to authenticated;

-- Child records follow the collection manager, while writes still identify the
-- currently signed-in manager in user_id. This supports ownership handoff.
drop policy if exists "Users can read own item photos" on public.collection_item_photos;
drop policy if exists "Users can insert own item photos" on public.collection_item_photos;
drop policy if exists "Users can delete own item photos" on public.collection_item_photos;
create policy collection_item_photos_read_managed on public.collection_item_photos
  for select to authenticated using (exists (
    select 1 from public.collection_items ci
    where ci.id = collection_item_photos.collection_item_id
      and public.collection_can_manage_profile(ci.collection_profile_id)
  ));
create policy collection_item_photos_insert_managed on public.collection_item_photos
  for insert to authenticated with check (
    user_id = (select auth.uid()) and exists (
      select 1 from public.collection_items ci
      where ci.id = collection_item_photos.collection_item_id
        and public.collection_can_manage_profile(ci.collection_profile_id)
    )
  );
create policy collection_item_photos_delete_managed on public.collection_item_photos
  for delete to authenticated using (exists (
    select 1 from public.collection_items ci
    where ci.id = collection_item_photos.collection_item_id
      and public.collection_can_manage_profile(ci.collection_profile_id)
  ));

drop policy if exists "Users read own item boosters" on public.collection_item_boosters;
drop policy if exists "Users add own item boosters" on public.collection_item_boosters;
drop policy if exists "Users update own item boosters" on public.collection_item_boosters;
drop policy if exists "Users delete own item boosters" on public.collection_item_boosters;
create policy collection_item_boosters_read_managed on public.collection_item_boosters
  for select to authenticated using (exists (
    select 1 from public.collection_items ci where ci.id = collection_item_boosters.collection_item_id
      and public.collection_can_manage_profile(ci.collection_profile_id)
  ));
create policy collection_item_boosters_insert_managed on public.collection_item_boosters
  for insert to authenticated with check (user_id = (select auth.uid()) and exists (
    select 1 from public.collection_items ci where ci.id = collection_item_boosters.collection_item_id
      and public.collection_can_manage_profile(ci.collection_profile_id)
  ));
create policy collection_item_boosters_update_managed on public.collection_item_boosters
  for update to authenticated using (exists (
    select 1 from public.collection_items ci where ci.id = collection_item_boosters.collection_item_id
      and public.collection_can_manage_profile(ci.collection_profile_id)
  )) with check (user_id = (select auth.uid()) and exists (
    select 1 from public.collection_items ci where ci.id = collection_item_boosters.collection_item_id
      and public.collection_can_manage_profile(ci.collection_profile_id)
  ));
create policy collection_item_boosters_delete_managed on public.collection_item_boosters
  for delete to authenticated using (exists (
    select 1 from public.collection_items ci where ci.id = collection_item_boosters.collection_item_id
      and public.collection_can_manage_profile(ci.collection_profile_id)
  ));

drop policy if exists "Users read own reference contributions" on public.booster_reference_contributions;
drop policy if exists "Users create own reference contributions" on public.booster_reference_contributions;
drop policy if exists "Users delete pending own reference contributions" on public.booster_reference_contributions;
create policy booster_contributions_read_managed on public.booster_reference_contributions
  for select to authenticated using (
    user_id = (select auth.uid()) or exists (
      select 1 from public.collection_items ci where ci.id = booster_reference_contributions.collection_item_id
        and public.collection_can_manage_profile(ci.collection_profile_id)
    )
  );
create policy booster_contributions_insert_managed on public.booster_reference_contributions
  for insert to authenticated with check (user_id = (select auth.uid()) and exists (
    select 1 from public.collection_items ci
    join public.collection_item_photos p on p.id = booster_reference_contributions.collection_item_photo_id
      and p.collection_item_id = ci.id
    where ci.id = booster_reference_contributions.collection_item_id
      and public.collection_can_manage_profile(ci.collection_profile_id)
  ));
create policy booster_contributions_delete_managed on public.booster_reference_contributions
  for delete to authenticated using (status = 'pending' and user_id = (select auth.uid()));

-- Storage policies can follow an image's linked collection after handoff even
-- when its immutable object path still begins with the previous manager's UID.
create or replace function public.collection_can_access_image(object_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.collection_items ci
    where ci.photo_path = object_path
      and public.collection_can_manage_profile(ci.collection_profile_id)
  ) or exists (
    select 1 from public.collection_item_photos p
    join public.collection_items ci on ci.id = p.collection_item_id
    where p.photo_path = object_path
      and public.collection_can_manage_profile(ci.collection_profile_id)
  );
$$;
revoke all on function public.collection_can_access_image(text) from public, anon;
grant execute on function public.collection_can_access_image(text) to authenticated;

create or replace function public.collection_image_is_linked(object_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (storage.foldername(object_path))[1] = (select auth.uid())::text
    and (
      exists (select 1 from public.collection_items ci where ci.photo_path = object_path)
      or exists (select 1 from public.collection_item_photos p where p.photo_path = object_path)
    );
$$;
revoke all on function public.collection_image_is_linked(text) from public, anon;
grant execute on function public.collection_image_is_linked(text) to authenticated;

drop policy if exists "Users can view own collection images" on storage.objects;
drop policy if exists "Users can upload own collection images" on storage.objects;
drop policy if exists "Users can update own collection images" on storage.objects;
drop policy if exists "Users can delete own collection images" on storage.objects;
create policy collection_images_read_managed on storage.objects
  for select to authenticated using (bucket_id = 'collection-images' and (
    public.collection_can_access_image(name) or (
      (storage.foldername(name))[1] = (select auth.uid())::text and not public.collection_image_is_linked(name)
    )
  ));
create policy collection_images_insert_own on storage.objects
  for insert to authenticated with check (
    bucket_id = 'collection-images' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy collection_images_update_managed on storage.objects
  for update to authenticated using (bucket_id = 'collection-images' and (
    public.collection_can_access_image(name) or (
      (storage.foldername(name))[1] = (select auth.uid())::text and not public.collection_image_is_linked(name)
    )
  )) with check (bucket_id = 'collection-images' and (
    public.collection_can_access_image(name) or (
      (storage.foldername(name))[1] = (select auth.uid())::text and not public.collection_image_is_linked(name)
    )
  ));
create policy collection_images_delete_managed on storage.objects
  for delete to authenticated using (bucket_id = 'collection-images' and (
    public.collection_can_access_image(name) or (
      (storage.foldername(name))[1] = (select auth.uid())::text and not public.collection_image_is_linked(name)
    )
  ));

create table public.collection_transfer_invites (
  id uuid primary key default gen_random_uuid(),
  collection_profile_id uuid not null references public.collection_profiles(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  check (expires_at > created_at),
  check ((accepted_at is null) = (accepted_by is null))
);
create index collection_transfer_invites_profile_idx
  on public.collection_transfer_invites (collection_profile_id, created_at desc);
alter table public.collection_transfer_invites enable row level security;
revoke all on public.collection_transfer_invites from anon, authenticated;

create or replace function public.create_collection_transfer_invite(profile_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw_token text := encode(extensions.gen_random_bytes(32), 'hex');
  profile_row public.collection_profiles%rowtype;
begin
  select * into profile_row from public.collection_profiles where id = profile_id for update;
  if not found or profile_row.manager_user_id <> (select auth.uid()) or profile_row.profile_type <> 'child' then
    raise exception 'Collection enfant introuvable ou accès refusé.' using errcode = '42501';
  end if;
  update public.collection_transfer_invites
    set revoked_at = now()
    where collection_profile_id = profile_id and accepted_at is null and revoked_at is null;
  insert into public.collection_transfer_invites (
    collection_profile_id, token_hash, created_by, expires_at
  ) values (
    profile_id, encode(extensions.digest(raw_token, 'sha256'), 'hex'), (select auth.uid()), now() + interval '7 days'
  );
  return raw_token;
end;
$$;
revoke all on function public.create_collection_transfer_invite(uuid) from public, anon;
grant execute on function public.create_collection_transfer_invite(uuid) to authenticated;

create or replace function public.accept_collection_transfer_invite(raw_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_row public.collection_transfer_invites%rowtype;
  target_profile public.collection_profiles%rowtype;
  recipient uuid := (select auth.uid());
  invite_id uuid;
  profile_id uuid;
  original_manager uuid;
begin
  if recipient is null or raw_token is null or char_length(raw_token) <> 64 then
    raise exception 'Invitation invalide.' using errcode = '22023';
  end if;
  select id, collection_profile_id into invite_id, profile_id
    from public.collection_transfer_invites
    where token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex');
  if not found then
    raise exception 'Cette invitation est invalide, expirée ou déjà utilisée.' using errcode = '22023';
  end if;

  select manager_user_id into original_manager
    from public.collection_profiles where id = profile_id;
  if not found then
    raise exception 'Cette collection ne peut plus être transférée.' using errcode = '22023';
  end if;

  -- Lock both managers in UUID order before locking the profile or invite rows.
  -- Ordinary collection writes take the same advisory lock for their manager.
  if original_manager < recipient then
    perform public.lock_collection_manager_for_write(original_manager);
    perform public.lock_collection_manager_for_write(recipient);
  elsif recipient < original_manager then
    perform public.lock_collection_manager_for_write(recipient);
    perform public.lock_collection_manager_for_write(original_manager);
  else
    perform public.lock_collection_manager_for_write(original_manager);
  end if;

  -- Keep profile-before-invite row locking, matching create_collection_transfer_invite.
  select * into target_profile from public.collection_profiles where id = profile_id for update;
  select * into invite_row from public.collection_transfer_invites where id = invite_id for update;
  if not found or invite_row.accepted_at is not null or invite_row.revoked_at is not null or invite_row.expires_at <= now() then
    raise exception 'Cette invitation est invalide, expirée ou déjà utilisée.' using errcode = '22023';
  end if;
  if target_profile.id is null
    or invite_row.collection_profile_id <> target_profile.id
    or target_profile.manager_user_id <> invite_row.created_by
    or recipient = target_profile.manager_user_id then
    raise exception 'Cette collection ne peut plus être transférée.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.trade_listings l
    join public.collection_items ci on ci.id = l.collection_item_id
    where ci.collection_profile_id = target_profile.id and l.status = 'active'
  ) or exists (
    select 1
    from public.trade_offers o
    left join public.trade_listings l on l.id = o.listing_id
    left join public.collection_items offered_ci on offered_ci.id = o.offered_collection_item_id
    left join public.collection_items listed_ci on listed_ci.id = l.collection_item_id
    where o.status = 'pending'
      and (offered_ci.collection_profile_id = target_profile.id
        or listed_ci.collection_profile_id = target_profile.id)
  ) then
    raise exception 'Annule ou termine les échanges en cours avant le transfert.' using errcode = '55000';
  end if;

  update public.collection_profiles
    set manager_user_id = recipient, profile_type = 'personal', transferred_at = now()
    where id = target_profile.id;
  update public.collection_items set user_id = recipient
    where collection_profile_id = target_profile.id;
  update public.collection_item_photos set user_id = recipient
    where collection_item_id in (select id from public.collection_items where collection_profile_id = target_profile.id);
  update public.collection_item_boosters set user_id = recipient
    where collection_item_id in (select id from public.collection_items where collection_profile_id = target_profile.id);
  -- Consent authorship and historical trade listings remain with their creators.
  -- Their item/photo foreign keys remain valid after the collection handoff.
  update public.collection_transfer_invites set accepted_at = now(), accepted_by = recipient
    where id = invite_row.id;
  return target_profile.id;
end;
$$;
revoke all on function public.accept_collection_transfer_invite(text) from public, anon;
grant execute on function public.accept_collection_transfer_invite(text) to authenticated;

-- Items from child profiles must never be listed in social trading surfaces.
drop policy if exists "Eligible members manage own trade listings" on public.trade_listings;
create policy "Eligible members manage own trade listings" on public.trade_listings
  for insert to authenticated with check (
    user_id = (select auth.uid()) and trade_can_participate((select auth.uid())) and exists (
      select 1 from public.collection_items ci
      join public.collection_profiles cp on cp.id = ci.collection_profile_id
      where ci.id = trade_listings.collection_item_id and ci.user_id = (select auth.uid())
        and cp.profile_type = 'personal'
    )
  );

-- Keep child-owned items out of offers and listing updates too.
drop policy if exists "Members update own trade listings" on public.trade_listings;
create policy "Members update own trade listings" on public.trade_listings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid()) and exists (
      select 1 from public.collection_items ci
      join public.collection_profiles cp on cp.id = ci.collection_profile_id
      where ci.id = trade_listings.collection_item_id
        and ci.user_id = (select auth.uid())
        and cp.profile_type = 'personal'
    )
  );

drop policy if exists "Eligible members create offers" on public.trade_offers;
create policy "Eligible members create offers" on public.trade_offers
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and recipient_id <> (select auth.uid())
    and public.trade_can_participate((select auth.uid()))
    and exists (
      select 1 from public.trade_listings l
      where l.id = trade_offers.listing_id
        and l.user_id = trade_offers.recipient_id
        and l.status = 'active'
    )
    and (
      offered_collection_item_id is null
      or exists (
        select 1 from public.collection_items ci
        join public.collection_profiles cp on cp.id = ci.collection_profile_id
        where ci.id = trade_offers.offered_collection_item_id
          and ci.user_id = (select auth.uid())
          and cp.profile_type = 'personal'
      )
    )
  );

drop policy if exists "Trade participants update offers" on public.trade_offers;
create policy "Trade participants update offers" on public.trade_offers
  for update to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()))
  with check (
    (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()))
    and (
      offered_collection_item_id is null
      or exists (
        select 1 from public.collection_items ci
        join public.collection_profiles cp on cp.id = ci.collection_profile_id
        where ci.id = trade_offers.offered_collection_item_id
          and ci.user_id = trade_offers.sender_id
          and cp.profile_type = 'personal'
      )
    )
  );

-- Serialize trade creation against a collection transfer. The transfer locks
-- collection_profiles FOR UPDATE; these triggers take FOR SHARE on the same
-- row and recheck ownership after any concurrent transfer completes.
create or replace function public.validate_trade_listing_collection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_row public.collection_profiles%rowtype;
  item_owner uuid;
begin
  if new.status <> 'active' then
    return new;
  end if;

  select cp.* into profile_row
  from public.collection_items ci
  join public.collection_profiles cp on cp.id = ci.collection_profile_id
  where ci.id = new.collection_item_id
  for share of cp;
  if not found then
    raise exception 'Collection introuvable pour cette annonce.' using errcode = '42501';
  end if;

  select ci.user_id into item_owner
  from public.collection_items ci
  where ci.id = new.collection_item_id;

  if profile_row.manager_user_id <> new.user_id
    or item_owner <> new.user_id
    or profile_row.profile_type <> 'personal'
  then
    raise exception 'Seul le propriétaire peut publier un objet de sa collection personnelle.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_trade_listing_collection() from public, anon;
grant execute on function public.validate_trade_listing_collection() to authenticated, service_role;
drop trigger if exists validate_trade_listing_collection on public.trade_listings;
create trigger validate_trade_listing_collection
before insert or update of collection_item_id, user_id, status on public.trade_listings
for each row execute function public.validate_trade_listing_collection();

create or replace function public.validate_trade_offer_collection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_row public.collection_profiles%rowtype;
  item_owner uuid;
begin
  if new.status <> 'pending' or new.offered_collection_item_id is null then
    return new;
  end if;

  select cp.* into profile_row
  from public.collection_items ci
  join public.collection_profiles cp on cp.id = ci.collection_profile_id
  where ci.id = new.offered_collection_item_id
  for share of cp;
  if not found then
    raise exception 'Collection introuvable pour cet objet proposé.' using errcode = '42501';
  end if;

  select ci.user_id into item_owner
  from public.collection_items ci
  where ci.id = new.offered_collection_item_id;

  if profile_row.manager_user_id <> new.sender_id
    or item_owner <> new.sender_id
    or profile_row.profile_type <> 'personal'
  then
    raise exception 'Seul le propriétaire peut proposer un objet de sa collection personnelle.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_trade_offer_collection() from public, anon;
grant execute on function public.validate_trade_offer_collection() to authenticated, service_role;
drop trigger if exists validate_trade_offer_collection on public.trade_offers;
create trigger validate_trade_offer_collection
before insert or update of offered_collection_item_id, sender_id, status on public.trade_offers
for each row execute function public.validate_trade_offer_collection();
