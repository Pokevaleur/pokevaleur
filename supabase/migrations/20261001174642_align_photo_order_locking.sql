create or replace function public.set_collection_item_photo_order(p_item_id uuid, p_photo_ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_count integer;
  v_profile uuid;
begin
  if (select auth.uid()) is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  -- Use the same manager advisory lock as family transfers, before item locks.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('collection-manager:' || (select auth.uid())::text, 0));
  select ci.collection_profile_id into v_profile from public.collection_items ci where ci.id = p_item_id for update;
  if not found or not public.collection_can_manage_profile(v_profile) then raise exception 'Collection inaccessible.' using errcode = '42501'; end if;
  select count(*) into v_count from public.collection_item_photos p where p.collection_item_id = p_item_id;
  if p_photo_ids is null or array_ndims(p_photo_ids) is distinct from 1
     or array_lower(p_photo_ids, 1) is distinct from 1 or cardinality(p_photo_ids) = 0 or cardinality(p_photo_ids) <> v_count
     or (select count(distinct id) from unnest(p_photo_ids) as u(id)) <> v_count
     or (select count(*) from public.collection_item_photos p where p.collection_item_id = p_item_id and p.id = any(p_photo_ids)) <> v_count then
    raise exception 'La liste des photos a changé. Recharge la fiche.' using errcode = '22023';
  end if;
  update public.collection_item_photos p set sort_order = u.position - 1
  from unnest(p_photo_ids) with ordinality as u(id, position)
  where p.id = u.id and p.collection_item_id = p_item_id;
  update public.collection_items ci set photo_path = (select p.photo_path from public.collection_item_photos p where p.id = p_photo_ids[1] and p.collection_item_id = p_item_id)
  where ci.id = p_item_id;
end;
$$;
revoke all on function public.set_collection_item_photo_order(uuid, uuid[]) from public, anon;
grant execute on function public.set_collection_item_photo_order(uuid, uuid[]) to authenticated;
