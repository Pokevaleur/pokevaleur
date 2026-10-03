-- Gate community and trade data on explicit, server-recorded social consent.
-- A collection transfer remains available when the social-consent check fails.

alter table public.collection_transfer_invites
  add column if not exists social_invitee_age_band text,
  add column if not exists social_parent_consent_at timestamptz,
  add column if not exists social_parent_consent_version text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.collection_transfer_invites'::regclass
      and conname = 'collection_transfer_invites_social_age_band_check'
  ) then
    alter table public.collection_transfer_invites
      add constraint collection_transfer_invites_social_age_band_check
      check (social_invitee_age_band is null or social_invitee_age_band = 'under_15');
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.collection_transfer_invites'::regclass
      and conname = 'collection_transfer_invites_social_consent_pair_check'
  ) then
    alter table public.collection_transfer_invites
      add constraint collection_transfer_invites_social_consent_pair_check
      check (
        (social_parent_consent_at is null and social_parent_consent_version is null)
        or (social_parent_consent_at is not null
          and social_parent_consent_version is not null
          and social_invitee_age_band = 'under_15')
      );
  end if;
end;
$$;

create table if not exists public.social_access_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  age_band text not null check (age_band in ('under_15', '15_or_over')),
  consent_version text not null check (char_length(consent_version) between 1 and 64),
  age_declared_at timestamptz not null default now(),
  consented_at timestamptz,
  parent_user_id uuid references auth.users(id) on delete set null,
  parent_consented_at timestamptz,
  child_assented_at timestamptz,
  constraint social_access_consents_age_proof_check check (
    (age_band = '15_or_over'
      and parent_consented_at is null
      and child_assented_at is null)
    or (age_band = 'under_15'
      and ((parent_consented_at is null and child_assented_at is null and consented_at is null)
        or (parent_consented_at is not null and child_assented_at is not null
          and consented_at is not null)))
  )
);
alter table public.social_access_consents enable row level security;
revoke all on public.social_access_consents from public, anon, authenticated;
grant all on public.social_access_consents to service_role;

create or replace function public.social_access_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.social_access_consents c
    where c.user_id = (select auth.uid())
      and (
        (c.age_band = '15_or_over' and c.consented_at is not null)
        or (c.age_band = 'under_15'
          and c.consented_at is not null
          and c.parent_consented_at is not null
          and c.child_assented_at is not null)
      )
  );
$$;
revoke all on function public.social_access_allowed() from public, anon;
grant execute on function public.social_access_allowed() to authenticated;

create or replace function public.get_social_access_status()
returns table (can_access boolean, age_band text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.social_access_allowed(),
    (select c.age_band from public.social_access_consents c
      where c.user_id = (select auth.uid()));
$$;
revoke all on function public.get_social_access_status() from public, anon;
grant execute on function public.get_social_access_status() to authenticated;

create or replace function public.record_adult_social_consent(
  p_age_confirmed boolean,
  p_terms_version text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  current_terms constant text := 'social-v1-2026-10-03';
begin
  if actor is null then
    raise exception 'Connecte-toi pour continuer.' using errcode = '42501';
  end if;
  if p_age_confirmed is distinct from true or p_terms_version is distinct from current_terms then
    raise exception 'Confirme que tu as 15 ans ou plus et accepte les règles en vigueur.' using errcode = '22023';
  end if;
  insert into public.social_access_consents (
    user_id, age_band, consent_version, age_declared_at, consented_at, parent_user_id,
    parent_consented_at, child_assented_at
  ) values (
    actor, '15_or_over', current_terms, now(), now(), null, null, null
  )
  on conflict (user_id) do update set
    age_band = excluded.age_band,
    consent_version = excluded.consent_version,
    age_declared_at = excluded.age_declared_at,
    consented_at = excluded.consented_at,
    parent_user_id = null,
    parent_consented_at = null,
    child_assented_at = null;
  return true;
end;
$$;
revoke all on function public.record_adult_social_consent(boolean, text) from public, anon;
grant execute on function public.record_adult_social_consent(boolean, text) to authenticated;

create or replace function public.withdraw_social_access_consent()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'Connecte-toi pour continuer.' using errcode = '42501';
  end if;
  update public.social_access_consents set
    consented_at = null,
    parent_user_id = null,
    parent_consented_at = null,
    child_assented_at = null
  where user_id = actor;
  return true;
end;
$$;
revoke all on function public.withdraw_social_access_consent() from public, anon;
grant execute on function public.withdraw_social_access_consent() to authenticated;

create or replace function public.record_under_15_age_declaration()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  current_terms constant text := 'social-v1-2026-10-03';
begin
  if actor is null then
    raise exception 'Connecte-toi pour continuer.' using errcode = '42501';
  end if;
  insert into public.social_access_consents (
    user_id, age_band, consent_version, age_declared_at, consented_at,
    parent_user_id, parent_consented_at, child_assented_at
  ) values (actor, 'under_15', current_terms, now(), null, null, null, null)
  on conflict (user_id) do update set
    age_band = 'under_15',
    consent_version = current_terms,
    age_declared_at = now(),
    consented_at = null,
    parent_user_id = null,
    parent_consented_at = null,
    child_assented_at = null;
  return true;
end;
$$;
revoke all on function public.record_under_15_age_declaration() from public, anon;
grant execute on function public.record_under_15_age_declaration() to authenticated;

create or replace function public.create_collection_transfer_invite_with_parent_consent(
  profile_id uuid,
  p_parent_consent boolean,
  p_terms_version text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw_token text := encode(extensions.gen_random_bytes(32), 'hex');
  actor uuid := (select auth.uid());
  profile_row public.collection_profiles%rowtype;
  current_terms constant text := 'social-v1-2026-10-03';
begin
  if actor is null then
    raise exception 'Connecte-toi pour continuer.' using errcode = '42501';
  end if;
  if p_parent_consent is true and p_terms_version is distinct from current_terms then
    raise exception 'La version des règles a changé. Actualise la page puis réessaie.' using errcode = '22023';
  end if;
  select * into profile_row from public.collection_profiles where id = profile_id for update;
  if not found or profile_row.manager_user_id <> actor or profile_row.profile_type <> 'child' then
    raise exception 'Collection enfant introuvable ou accès refusé.' using errcode = '42501';
  end if;
  update public.collection_transfer_invites
    set revoked_at = now()
    where collection_profile_id = profile_id and accepted_at is null and revoked_at is null;
  insert into public.collection_transfer_invites (
    collection_profile_id, token_hash, created_by, expires_at,
    social_invitee_age_band, social_parent_consent_at, social_parent_consent_version
  ) values (
    profile_id,
    encode(extensions.digest(raw_token, 'sha256'), 'hex'),
    actor,
    now() + interval '7 days',
    case when p_parent_consent then 'under_15' else null end,
    case when p_parent_consent then now() else null end,
    case when p_parent_consent then current_terms else null end
  );
  return raw_token;
end;
$$;
revoke all on function public.create_collection_transfer_invite_with_parent_consent(uuid, boolean, text) from public, anon;
grant execute on function public.create_collection_transfer_invite_with_parent_consent(uuid, boolean, text) to authenticated;

create or replace function public.record_transferred_child_social_assent(
  raw_token text,
  p_child_assent boolean,
  p_terms_version text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  invite_row public.collection_transfer_invites%rowtype;
  current_terms constant text := 'social-v1-2026-10-03';
begin
  if actor is null then
    raise exception 'Connecte-toi pour continuer.' using errcode = '42501';
  end if;
  if p_child_assent is distinct from true or p_terms_version is distinct from current_terms
    or raw_token is null or char_length(raw_token) <> 64 then
    raise exception 'Le consentement du jeune n’a pas été confirmé.' using errcode = '22023';
  end if;
  select * into invite_row
    from public.collection_transfer_invites
    where token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex')
      and accepted_by = actor
      and accepted_at is not null
      and social_invitee_age_band = 'under_15'
      and social_parent_consent_at is not null
      and social_parent_consent_version = current_terms;
  if not found then
    raise exception 'Aucun accord parental correspondant à ce transfert n’a été trouvé. La collection reste transférée, mais les fonctions sociales demeurent bloquées.' using errcode = '42501';
  end if;
  insert into public.social_access_consents (
    user_id, age_band, consent_version, age_declared_at, consented_at, parent_user_id,
    parent_consented_at, child_assented_at
  ) values (
    actor, 'under_15', current_terms, now(), now(), invite_row.created_by,
    invite_row.social_parent_consent_at, now()
  )
  on conflict (user_id) do update set
    age_band = excluded.age_band,
    consent_version = excluded.consent_version,
    age_declared_at = excluded.age_declared_at,
    consented_at = excluded.consented_at,
    parent_user_id = excluded.parent_user_id,
    parent_consented_at = excluded.parent_consented_at,
    child_assented_at = excluded.child_assented_at;
  return true;
end;
$$;
revoke all on function public.record_transferred_child_social_assent(text, boolean, text) from public, anon;
grant execute on function public.record_transferred_child_social_assent(text, boolean, text) to authenticated;

-- The catalogue-size threshold is necessary but no longer sufficient.
create or replace function public.community_can_post(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user = (select auth.uid())
    and public.social_access_allowed()
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
    and public.social_access_allowed()
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

-- Gate reads as well as writes. Admin-only policies remain independent.
drop policy if exists "Authenticated read community channels" on public.community_channels;
create policy "Consenting members read community channels"
  on public.community_channels for select to authenticated
  using (public.social_access_allowed() and is_public = true);

drop policy if exists "Authenticated can read visible community messages" on public.community_messages;
create policy "Consenting members read visible community messages"
  on public.community_messages for select to authenticated
  using (public.social_access_allowed() and is_hidden = false and not exists (
    select 1 from public.community_blocks b
    where b.blocker_id = (select auth.uid()) and b.blocked_id = community_messages.user_id
  ));

drop policy if exists "Authors can delete own community messages" on public.community_messages;
create policy "Consenting authors delete own community messages"
  on public.community_messages for delete to authenticated
  using (public.social_access_allowed() and user_id = (select auth.uid()));

drop policy if exists "Users manage own blocks" on public.community_blocks;
create policy "Consenting users manage own blocks"
  on public.community_blocks for all to authenticated
  using (public.social_access_allowed() and blocker_id = (select auth.uid()))
  with check (public.social_access_allowed() and blocker_id = (select auth.uid()));

drop policy if exists "Users create own reports" on public.community_reports;
create policy "Consenting users create own reports"
  on public.community_reports for insert to authenticated
  with check (public.social_access_allowed() and reporter_id = (select auth.uid()));
drop policy if exists "Users read own reports" on public.community_reports;
create policy "Consenting users read own reports"
  on public.community_reports for select to authenticated
  using (public.social_access_allowed() and reporter_id = (select auth.uid()));

drop policy if exists "Authenticated can read active trade listings" on public.trade_listings;
create policy "Consenting members read active trade listings"
  on public.trade_listings for select to authenticated
  using (public.social_access_allowed() and (status = 'active' or user_id = (select auth.uid())));
drop policy if exists "Members update own trade listings" on public.trade_listings;
create policy "Consenting members update own trade listings"
  on public.trade_listings for update to authenticated
  using (public.social_access_allowed() and user_id = (select auth.uid()))
  with check (public.social_access_allowed() and user_id = (select auth.uid()) and exists (
    select 1 from public.collection_items ci
    join public.collection_profiles cp on cp.id = ci.collection_profile_id
    where ci.id = trade_listings.collection_item_id
      and ci.user_id = (select auth.uid()) and cp.profile_type = 'personal'
  ));
drop policy if exists "Members delete own trade listings" on public.trade_listings;
create policy "Consenting members delete own trade listings"
  on public.trade_listings for delete to authenticated
  using (public.social_access_allowed() and user_id = (select auth.uid()));

drop policy if exists "Trade participants read offers" on public.trade_offers;
create policy "Consenting participants read offers"
  on public.trade_offers for select to authenticated
  using (public.social_access_allowed() and (sender_id = (select auth.uid()) or recipient_id = (select auth.uid())));
drop policy if exists "Trade participants update offers" on public.trade_offers;
create policy "Consenting participants update offers"
  on public.trade_offers for update to authenticated
  using (public.social_access_allowed() and (sender_id = (select auth.uid()) or recipient_id = (select auth.uid())))
  with check (public.social_access_allowed() and (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()))
    and (offered_collection_item_id is null or exists (
      select 1 from public.collection_items ci
      join public.collection_profiles cp on cp.id = ci.collection_profile_id
      where ci.id = trade_offers.offered_collection_item_id
        and ci.user_id = trade_offers.sender_id and cp.profile_type = 'personal'
    )));

drop policy if exists "Trade participants read messages" on public.trade_messages;
create policy "Consenting participants read messages"
  on public.trade_messages for select to authenticated
  using (public.social_access_allowed() and exists (
    select 1 from public.trade_offers o
    where o.id = trade_messages.trade_offer_id
      and (o.sender_id = (select auth.uid()) or o.recipient_id = (select auth.uid()))
  ));
drop policy if exists "Trade participants send messages" on public.trade_messages;
create policy "Consenting participants send messages"
  on public.trade_messages for insert to authenticated
  with check (public.social_access_allowed() and sender_id = (select auth.uid()) and exists (
    select 1 from public.trade_offers o
    where o.id = trade_messages.trade_offer_id
      and (o.sender_id = (select auth.uid()) or o.recipient_id = (select auth.uid()))
  ));
