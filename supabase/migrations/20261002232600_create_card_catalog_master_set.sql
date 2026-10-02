-- Foundation for Pokémon card checklists, print variants, collection copies and market observations.
-- Catalog rows retain guide terminology; finish/mechanic/style are separate axes.

create table if not exists public.card_sets (
  id uuid primary key default gen_random_uuid(),
  series_name text not null,
  set_name text not null,
  set_code text,
  language text not null default 'FR',
  release_date date,
  advertised_card_count integer check (advertised_card_count is null or advertised_card_count >= 0),
  checklist_source_url text,
  checklist_scope_note text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  constraint card_sets_name_language_unique unique (set_name, language)
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  card_set_id uuid not null references public.card_sets(id) on delete restrict,
  collector_number text not null,
  card_name text not null,
  card_type text,
  guide_category_label text,
  guide_category_code text,
  rarity_label text,
  mechanic_label text,
  illustration_style text,
  guide_order integer,
  image_url text,
  image_source_url text,
  source_url text,
  created_at timestamptz not null default now(),
  constraint cards_set_collector_number_unique unique (card_set_id, collector_number),
  constraint cards_guide_order_positive check (guide_order is null or guide_order > 0)
);

create table if not exists public.card_print_variants (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete restrict,
  variant_key text not null,
  variant_label text not null,
  finish_code text not null default 'standard',
  guide_marker text,
  checklist_group text not null default 'main',
  is_master_set_target boolean not null default true,
  created_at timestamptz not null default now(),
  constraint card_print_variants_card_key_unique unique (card_id, variant_key)
);

create table if not exists public.card_grading_companies (
  id uuid primary key default gen_random_uuid(),
  company_name text not null unique,
  abbreviation text,
  website_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.collection_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  collection_profile_id uuid not null references public.collection_profiles(id) on delete cascade,
  card_print_variant_id uuid not null references public.card_print_variants(id) on delete restrict,
  ownership_type text not null default 'raw' check (ownership_type in ('raw', 'graded')),
  raw_condition text,
  grading_company_id uuid references public.card_grading_companies(id) on delete restrict,
  grade numeric(3,1) check (grade is null or grade between 1 and 10),
  grade_label text,
  subgrades jsonb not null default '{}'::jsonb check (jsonb_typeof(subgrades) = 'object'),
  certification_number text,
  purchase_price numeric check (purchase_price is null or purchase_price >= 0),
  purchase_date date,
  purchase_place text,
  current_value_override numeric check (current_value_override is null or current_value_override >= 0),
  photo_path text,
  notes text,
  created_at timestamptz not null default now(),
  constraint collection_cards_grading_fields_consistent check (
    (ownership_type = 'raw' and grading_company_id is null and grade is null and certification_number is null)
    or
    (ownership_type = 'graded' and grading_company_id is not null and grade is not null)
  )
);

create table if not exists public.card_price_observations (
  id uuid primary key default gen_random_uuid(),
  card_print_variant_id uuid not null references public.card_print_variants(id) on delete restrict,
  price_kind text not null check (price_kind in ('raw', 'graded')),
  raw_condition text,
  grading_company_id uuid references public.card_grading_companies(id) on delete restrict,
  grade numeric(3,1) check (grade is null or grade between 1 and 10),
  observation_type text not null check (observation_type in ('confirmed_sale', 'observed_listing', 'estimate')),
  amount numeric not null check (amount >= 0),
  currency text not null default 'EUR',
  source text not null,
  source_url text,
  observed_at timestamptz not null default now(),
  constraint card_price_observation_grade_fields_consistent check (
    (price_kind = 'raw' and grading_company_id is null and grade is null)
    or
    (price_kind = 'graded' and grading_company_id is not null and grade is not null)
  )
);

create index if not exists cards_set_order_idx
  on public.cards (card_set_id, guide_order, collector_number);
create index if not exists card_print_variants_checklist_idx
  on public.card_print_variants (card_id, is_master_set_target, checklist_group);
create index if not exists collection_cards_profile_created_idx
  on public.collection_cards (collection_profile_id, created_at desc);
create index if not exists collection_cards_user_idx
  on public.collection_cards (user_id);
create index if not exists card_price_observations_variant_time_idx
  on public.card_price_observations (card_print_variant_id, observed_at desc);
create index if not exists card_price_observations_graded_lookup_idx
  on public.card_price_observations (card_print_variant_id, grading_company_id, grade, observed_at desc)
  where price_kind = 'graded';

alter table public.card_sets enable row level security;
alter table public.cards enable row level security;
alter table public.card_print_variants enable row level security;
alter table public.card_grading_companies enable row level security;
alter table public.collection_cards enable row level security;
alter table public.card_price_observations enable row level security;

revoke all on public.card_sets, public.cards, public.card_print_variants, public.card_grading_companies, public.collection_cards, public.card_price_observations from anon, authenticated;
grant select on public.card_sets, public.cards, public.card_print_variants, public.card_grading_companies, public.card_price_observations to anon, authenticated;
grant insert, update, delete on public.card_sets, public.cards, public.card_print_variants, public.card_grading_companies, public.card_price_observations to authenticated;
grant select, insert, update, delete on public.collection_cards to authenticated;

create policy card_sets_public_read
  on public.card_sets for select to anon, authenticated
  using (is_public);

create policy card_sets_admin_manage
  on public.card_sets for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));

create policy cards_public_read
  on public.cards for select to anon, authenticated
  using (exists (
    select 1 from public.card_sets s
    where s.id = card_set_id and s.is_public = true
  ));

create policy cards_admin_manage
  on public.cards for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));

create policy card_print_variants_public_read
  on public.card_print_variants for select to anon, authenticated
  using (exists (
    select 1 from public.cards c
    join public.card_sets s on s.id = c.card_set_id
    where c.id = card_id and s.is_public = true
  ));

create policy card_print_variants_admin_manage
  on public.card_print_variants for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));

create policy card_grading_companies_public_read
  on public.card_grading_companies for select to anon, authenticated
  using (is_active);

create policy card_grading_companies_admin_manage
  on public.card_grading_companies for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));

create policy collection_cards_managed_read
  on public.collection_cards for select to authenticated
  using (public.collection_can_manage_profile(collection_profile_id));

create policy collection_cards_managed_insert
  on public.collection_cards for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.collection_can_manage_profile(collection_profile_id)
  );

create policy collection_cards_managed_update
  on public.collection_cards for update to authenticated
  using (public.collection_can_manage_profile(collection_profile_id))
  with check (
    user_id = (select auth.uid())
    and public.collection_can_manage_profile(collection_profile_id)
  );

create policy collection_cards_managed_delete
  on public.collection_cards for delete to authenticated
  using (public.collection_can_manage_profile(collection_profile_id));

create policy card_price_observations_public_read
  on public.card_price_observations for select to anon, authenticated
  using (exists (
    select 1
    from public.card_print_variants v
    join public.cards c on c.id = v.card_id
    join public.card_sets s on s.id = c.card_set_id
    where v.id = card_print_variant_id and s.is_public = true
  ));

create policy card_price_observations_admin_manage
  on public.card_price_observations for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));

create trigger lock_collection_manager_before_write
  before insert or update or delete on public.collection_cards
  for each statement execute function public.lock_managed_collection_manager_for_write();