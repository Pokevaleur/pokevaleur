-- Trust profiles and reviews tied to mutually confirmed trades.
-- Social data stays unavailable to visitors without social access consent.

create table public.member_public_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_key text not null default 'star',
  updated_at timestamptz not null default now()
);
alter table public.member_public_profiles enable row level security;
revoke all on public.member_public_profiles from public, anon, authenticated;
grant select on public.member_public_profiles to authenticated;
create policy member_public_profiles_read_social
  on public.member_public_profiles
  for select to authenticated
  using (public.social_access_allowed());

create or replace function public.sync_member_public_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.member_public_profiles (user_id, display_name, avatar_key, updated_at)
  values (
    new.id,
    coalesce(nullif(btrim(new.display_name), ''), 'Membre-' || left(new.id::text, 8)),
    coalesce(nullif(new.avatar_key, ''), 'star'),
    now()
  )
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    avatar_key = excluded.avatar_key,
    updated_at = now();
  return new;
end;
$function$;
revoke all on function public.sync_member_public_profile() from public, anon, authenticated;
drop trigger if exists sync_member_public_profile on public.profiles;
create trigger sync_member_public_profile
  after insert or update of display_name, avatar_key on public.profiles
  for each row execute function public.sync_member_public_profile();

insert into public.member_public_profiles (user_id, display_name, avatar_key)
select id,
       coalesce(nullif(btrim(display_name), ''), 'Membre-' || left(id::text, 8)),
       coalesce(nullif(avatar_key, ''), 'star')
from public.profiles
on conflict (user_id) do update set
  display_name = excluded.display_name,
  avatar_key = excluded.avatar_key,
  updated_at = now();

create table public.member_external_profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  slot smallint not null check (slot in (1, 2)),
  platform text not null check (platform in ('vinted', 'cardmarket', 'ebay', 'other')),
  username text not null check (char_length(btrim(username)) between 1 and 80),
  profile_url text not null check (profile_url ~* '^https://[^[:space:]]+$'),
  rating numeric(3,2) check (rating between 0 and 5),
  review_count integer check (review_count >= 0),
  rating_updated_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, slot),
  unique (user_id, profile_url),
  constraint member_external_profiles_rating_pair_check check (
    (rating is null and review_count is null and rating_updated_at is null)
    or (rating is not null and review_count is not null and rating_updated_at is not null)
  )
);
alter table public.member_external_profiles enable row level security;
revoke all on public.member_external_profiles from public, anon, authenticated;
grant select, insert, update, delete on public.member_external_profiles to authenticated;
create policy member_external_profiles_read_social
  on public.member_external_profiles
  for select to authenticated
  using (public.social_access_allowed());
create policy member_external_profiles_manage_own
  on public.member_external_profiles
  for all to authenticated
  using (user_id = (select auth.uid()) and public.social_access_allowed())
  with check (user_id = (select auth.uid()) and public.social_access_allowed());

create table public.trade_completion_confirmations (
  trade_offer_id uuid not null references public.trade_offers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  confirmed_at timestamptz not null default now(),
  primary key (trade_offer_id, user_id)
);
create index trade_completion_confirmations_user_idx
  on public.trade_completion_confirmations(user_id, confirmed_at desc);
alter table public.trade_completion_confirmations enable row level security;
revoke all on public.trade_completion_confirmations from public, anon, authenticated;
grant select, insert on public.trade_completion_confirmations to authenticated;
create policy trade_completion_confirmations_read_participants
  on public.trade_completion_confirmations
  for select to authenticated
  using (
    public.social_access_allowed()
    and exists (
      select 1 from public.trade_offers o
      where o.id = trade_completion_confirmations.trade_offer_id
        and (o.sender_id = (select auth.uid()) or o.recipient_id = (select auth.uid()))
    )
  );
create policy trade_completion_confirmations_insert_own
  on public.trade_completion_confirmations
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.social_access_allowed()
    and exists (
      select 1 from public.trade_offers o
      where o.id = trade_completion_confirmations.trade_offer_id
        and o.status = 'accepted'
        and (o.sender_id = (select auth.uid()) or o.recipient_id = (select auth.uid()))
    )
  );

create table public.trade_reviews (
  id uuid primary key default gen_random_uuid(),
  trade_offer_id uuid not null references public.trade_offers(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  reviewed_user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(btrim(comment)) <= 500),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique (trade_offer_id, reviewer_id),
  constraint trade_reviews_not_self_check check (reviewer_id <> reviewed_user_id)
);
create index trade_reviews_reviewed_user_created_idx
  on public.trade_reviews(reviewed_user_id, created_at desc);
alter table public.trade_reviews enable row level security;
revoke all on public.trade_reviews from public, anon, authenticated;
grant select, insert on public.trade_reviews to authenticated;
grant update (is_hidden) on public.trade_reviews to authenticated;
create policy trade_reviews_read_visible
  on public.trade_reviews
  for select to authenticated
  using (public.social_access_allowed() and is_hidden = false);
create policy trade_reviews_read_admin
  on public.trade_reviews
  for select to authenticated
  using (
    public.social_access_allowed()
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin)
  );
create policy trade_reviews_create_after_mutual_confirmation
  on public.trade_reviews
  for insert to authenticated
  with check (
    reviewer_id = (select auth.uid())
    and public.social_access_allowed()
    and exists (
      select 1
      from public.trade_offers o
      where o.id = trade_reviews.trade_offer_id
        and o.status = 'accepted'
        and (
          (o.sender_id = trade_reviews.reviewer_id and o.recipient_id = trade_reviews.reviewed_user_id)
          or (o.recipient_id = trade_reviews.reviewer_id and o.sender_id = trade_reviews.reviewed_user_id)
        )
        and exists (
          select 1 from public.trade_completion_confirmations c
          where c.trade_offer_id = o.id and c.user_id = o.sender_id
        )
        and exists (
          select 1 from public.trade_completion_confirmations c
          where c.trade_offer_id = o.id and c.user_id = o.recipient_id
        )
    )
  );
create policy trade_reviews_moderate_admin
  on public.trade_reviews
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin));

create table public.trade_review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.trade_reviews(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (review_id, reporter_id)
);
create index trade_review_reports_status_created_idx
  on public.trade_review_reports(status, created_at desc);
alter table public.trade_review_reports enable row level security;
revoke all on public.trade_review_reports from public, anon, authenticated;
grant select, insert, update on public.trade_review_reports to authenticated;
create policy trade_review_reports_create
  on public.trade_review_reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and public.social_access_allowed()
    and exists (
      select 1 from public.trade_reviews r
      where r.id = trade_review_reports.review_id
        and r.reviewer_id <> (select auth.uid())
    )
  );
create policy trade_review_reports_read_admin
  on public.trade_review_reports
  for select to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin)
  );
create policy trade_review_reports_moderate_admin
  on public.trade_review_reports
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin));
