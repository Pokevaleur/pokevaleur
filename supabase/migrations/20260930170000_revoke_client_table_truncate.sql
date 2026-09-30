-- TRUNCATE bypasses row-level security and is not used by browser clients.
revoke truncate on all tables in schema public from anon, authenticated;

-- Supabase migrations run as postgres. Keep future migration-created tables
-- from inheriting this client privilege.
alter default privileges for role postgres in schema public
  revoke truncate on tables from anon, authenticated;
