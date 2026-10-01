-- Run only on the isolated family-collection fixtures; all data changes roll back.
begin;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
set local role authenticated;
do $$
declare ids uuid[]; legacy uuid; primary_path text;
begin
  select id into legacy from public.collection_item_photos where collection_item_id='30000000-0000-0000-0000-000000000001' limit 1;
  assert legacy is not null, 'Missing inherited test photo';
  insert into public.collection_item_photos(collection_item_id,user_id,photo_path,sort_order)
  values ('30000000-0000-0000-0000-000000000001',auth.uid(),auth.uid()::text||'/order-test.jpg',99);
  select array_agg(id order by sort_order desc) into ids from public.collection_item_photos where collection_item_id='30000000-0000-0000-0000-000000000001';
  perform public.set_collection_item_photo_order('30000000-0000-0000-0000-000000000001',ids);
  assert (select sort_order=0 from public.collection_item_photos where id=ids[1]), 'First position not saved';
  assert (select photo_path from public.collection_items where id='30000000-0000-0000-0000-000000000001') = (select photo_path from public.collection_item_photos where id=ids[1]), 'Primary not synchronized';
  -- Inherited file can also become primary after collection transfer.
  select array_agg(id order by (id=legacy) desc) into ids from public.collection_item_photos where collection_item_id='30000000-0000-0000-0000-000000000001';
  perform public.set_collection_item_photo_order('30000000-0000-0000-0000-000000000001',ids);
  assert (select photo_path from public.collection_items where id='30000000-0000-0000-0000-000000000001') = (select photo_path from public.collection_item_photos where id=legacy), 'Inherited primary denied';
  begin
    perform public.set_collection_item_photo_order('30000000-0000-0000-0000-000000000001',array[ids[1]]);
    raise exception 'Incomplete array accepted';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.set_collection_item_photo_order('30000000-0000-0000-0000-000000000001',array[ids[1],ids[1]]);
    raise exception 'Duplicate accepted';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.set_collection_item_photo_order('30000000-0000-0000-0000-000000000001',array[ids[1],gen_random_uuid()]);
    raise exception 'Foreign ID accepted';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.set_collection_item_photo_order('30000000-0000-0000-0000-000000000001',array[[ids[1],ids[2]]]);
    raise exception 'Multidimensional array accepted';
  exception when sqlstate '22023' then null; end;
  begin
    update public.collection_item_photos set photo_path=auth.uid()::text||'/tampered.jpg' where id=ids[1];
    raise exception 'Photo path editable';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
  begin
    perform public.set_collection_item_photo_order('30000000-0000-0000-0000-000000000001',ids);
    raise exception 'Other member accepted';
  exception when insufficient_privilege then null; end;
end;
$$;
set local role anon;
do $$ begin
  begin
    perform public.set_collection_item_photo_order('30000000-0000-0000-0000-000000000001',array[]::uuid[]);
    raise exception 'Guest accepted';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'photo ordering assertions passed; fixtures rolled back' as result;
