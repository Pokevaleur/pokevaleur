-- Allow authenticated administrators to read every catalogue row while
-- retaining the existing public-only policy for all other users.
create policy "admins_read_all_products"
on public.products
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_admin is true
  )
);
