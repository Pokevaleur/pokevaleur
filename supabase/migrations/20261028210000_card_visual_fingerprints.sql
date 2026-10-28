-- Compact perceptual fingerprints let the scanner compare a photo with the public card catalogue.
create table if not exists public.card_image_fingerprints (
  card_id uuid primary key references public.cards(id) on delete cascade,
  fingerprint bit(64) not null,
  updated_at timestamptz not null default now()
);

alter table public.card_image_fingerprints enable row level security;
revoke all on public.card_image_fingerprints from anon, authenticated;

create or replace function public.search_card_image_fingerprints(
  query_fingerprint bit(64),
  result_limit integer default 24
)
returns table(card_id uuid, distance integer)
language sql
stable
security definer
set search_path = public
as $$
  select f.card_id, bit_count(f.fingerprint # query_fingerprint)::integer as distance
  from public.card_image_fingerprints f
  join public.cards c on c.id = f.card_id
  join public.card_sets s on s.id = c.card_set_id
  where s.is_public = true
    and c.image_url is not null
    and bit_count(f.fingerprint # query_fingerprint) <= 20
  order by bit_count(f.fingerprint # query_fingerprint) asc
  limit greatest(1, least(coalesce(result_limit, 24), 40));
$$;

revoke all on function public.search_card_image_fingerprints(bit, integer) from public;
grant execute on function public.search_card_image_fingerprints(bit, integer) to anon, authenticated;
