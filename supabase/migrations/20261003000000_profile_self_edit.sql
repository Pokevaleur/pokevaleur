-- Let signed-in members edit only their nickname and avatar.
-- Keep profile ownership in the existing RLS policy and restrict writable columns.
create or replace function public.validate_profile_identity_update()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  -- Existing profiles may have legacy nicknames. Validate only a changed nickname.
  if new.display_name is distinct from old.display_name
    and (
      new.display_name is null
      or char_length(btrim(new.display_name)) not between 3 and 24
      or btrim(new.display_name) !~ '^[[:alnum:]_.-]+$'
    )
  then
    raise exception 'Invalid public nickname' using errcode = '23514';
  end if;

  return new;
end;
$function$;

revoke all on function public.validate_profile_identity_update() from public, anon, authenticated;
drop trigger if exists validate_profile_identity_update on public.profiles;
create trigger validate_profile_identity_update
before update of display_name, avatar_key on public.profiles
for each row execute function public.validate_profile_identity_update();

grant update (display_name, avatar_key)
  on table public.profiles to authenticated;
