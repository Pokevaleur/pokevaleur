-- Extend the existing private profile record with a unique public nickname and preset avatar.
-- The avatar key is presentation metadata only; it must never be used for authorization.
alter table public.profiles
  add column if not exists avatar_key text not null default 'star'
  check (avatar_key in ('star', 'fire', 'water', 'leaf', 'spark', 'crystal'));

-- Pseudo uniqueness is case-insensitive and ignores legacy blank names.
create unique index if not exists profiles_display_name_unique_ci
  on public.profiles (lower(btrim(display_name)))
  where display_name is not null and btrim(display_name) <> '';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  requested_name text;
  requested_avatar text;
begin
  if coalesce(new.raw_user_meta_data ? 'display_name', false) then
    requested_name := nullif(btrim(new.raw_user_meta_data ->> 'display_name'), '');
    if requested_name is null
      or char_length(requested_name) not between 3 and 24
      or requested_name !~ '^[[:alnum:]_-]+$'
    then
      raise exception 'Invalid public nickname';
    end if;
  else
    -- Keep older clients able to sign up during a staggered frontend rollout.
    requested_name := 'Membre-' || left(new.id::text, 12);
  end if;

  requested_avatar := case
    when new.raw_user_meta_data ->> 'avatar_key' in ('star', 'fire', 'water', 'leaf', 'spark', 'crystal')
      then new.raw_user_meta_data ->> 'avatar_key'
    else 'star'
  end;

  insert into public.profiles (id, display_name, avatar_key)
  values (
    new.id,
    requested_name,
    requested_avatar
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;
