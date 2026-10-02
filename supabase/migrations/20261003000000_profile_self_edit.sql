-- Let signed-in members edit only their nickname and avatar.
-- Keep profile ownership in the existing RLS policy and restrict writable columns.
alter table public.profiles
  add constraint profiles_display_name_format_check
  check (
    display_name is not null
    and char_length(btrim(display_name)) between 3 and 24
    and btrim(display_name) ~ '^[[:alnum:]_.-]+$'
  );

grant update (display_name, avatar_key)
  on table public.profiles to authenticated;
