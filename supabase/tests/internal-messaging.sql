-- Integration assertions run in one rolled-back transaction. No real member is messaged.
begin;
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values
 ('00000000-0000-4000-a000-000000001001','authenticated','authenticated','inbox-admin@example.invalid','{}','{"display_name":"InboxAdmin"}'),
 ('00000000-0000-4000-a000-000000001002','authenticated','authenticated','inbox-a@example.invalid','{}','{"display_name":"InboxAlice"}'),
 ('00000000-0000-4000-a000-000000001003','authenticated','authenticated','inbox-b@example.invalid','{}','{"display_name":"InboxBob"}'),
 ('00000000-0000-4000-a000-000000001004','authenticated','authenticated','inbox-outsider@example.invalid','{}','{"display_name":"InboxOutsider"}'),
 ('00000000-0000-4000-a000-000000001005','authenticated','authenticated','inbox-child@example.invalid','{}','{"display_name":"InboxChild"}');
insert into public.profiles(id,display_name,is_admin) values
 ('00000000-0000-4000-a000-000000001001','InboxAdmin',true),
 ('00000000-0000-4000-a000-000000001002','InboxAlice',false),
 ('00000000-0000-4000-a000-000000001003','InboxBob',false),
 ('00000000-0000-4000-a000-000000001004','InboxOutsider',false),
 ('00000000-0000-4000-a000-000000001005','InboxChild',false)
on conflict(id) do update set display_name=excluded.display_name,is_admin=excluded.is_admin;
insert into public.social_access_consents(user_id,age_band,consent_version)
values('00000000-0000-4000-a000-000000001005','under_15','test');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-a000-000000001002',true);
do $$ declare r jsonb; t uuid; n integer; begin
 if (public.messaging('status')->>'active')::boolean then raise exception 'unactivated member';end if;
 begin perform public.messaging('members');raise exception 'missing activation denied';exception when insufficient_privilege then null;end;
 perform public.messaging('activate','{"confirmed":true}');
 r:=public.messaging('send','{"recipient_id":"00000000-0000-4000-a000-000000001003","body":"Private test","client_id":"00000000-0000-4000-a000-000000002001"}');
 t:=(r->>'thread_id')::uuid;
 perform set_config('inbox_test.direct',t::text,true);
 perform public.messaging('send','{"recipient_id":"00000000-0000-4000-a000-000000001003","body":"Duplicate retry","client_id":"00000000-0000-4000-a000-000000002001"}');
 select count(*)into n from public.inbox_messages where thread_id=t;if n<>1 then raise exception 'idempotency';end if;
 if (select count(*)from public.inbox_participants where thread_id=t)<>1 then raise exception 'participant identities leaked';end if;
 begin insert into public.inbox_messages(thread_id,sender_name,body,client_id)values(t,'Fake','Fake',gen_random_uuid());raise exception 'direct writes allowed';exception when insufficient_privilege then null;end;
 begin perform public.messaging('announce','{"subject":"Fake","body":"Fake","client_id":"00000000-0000-4000-a000-000000002002","expected_recipients":1}');raise exception 'nonadmin broadcast';exception when insufficient_privilege then null;end;
 if exists(select 1 from jsonb_array_elements(public.messaging('members'))x where x->>'id'='00000000-0000-4000-a000-000000001005' or x?'email')then raise exception 'directory minor/email';end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-a000-000000001004',true);
do $$begin
 perform public.messaging('activate','{"confirmed":true}');
 if (select count(*)from public.inbox_messages)<>0 then raise exception 'outsider RLS';end if;
 begin perform public.messaging('thread',jsonb_build_object('thread_id',current_setting('inbox_test.direct')));raise exception 'outsider RPC';exception when insufficient_privilege then null;end;
 begin perform public.messaging('read',jsonb_build_object('thread_id',current_setting('inbox_test.direct'),'last_id',1));raise exception 'outsider read';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-a000-000000001003',true);
do $$declare t uuid:=current_setting('inbox_test.direct')::uuid;r jsonb;m bigint;begin
 perform public.messaging('activate','{"confirmed":true}');
 if (public.messaging('status')->>'unread')::integer<>1 then raise exception 'recipient unread';end if;
 r:=public.messaging('thread',jsonb_build_object('thread_id',t));m:=(r->'messages'->0->>'id')::bigint;
 perform public.messaging('read',jsonb_build_object('thread_id',t,'last_id',m));
 if (public.messaging('status')->>'unread')::integer<>0 then raise exception 'mark read';end if;
 perform public.messaging('archive',jsonb_build_object('thread_id',t,'archived',true));
 if jsonb_array_length(public.messaging('inbox'))<>0 then raise exception 'archive';end if;
 if jsonb_array_length(public.messaging('inbox','{"archived":true}'))<>1 then raise exception 'archive retrieval';end if;
 perform public.messaging('report',jsonb_build_object('message_id',m,'reason','Integration test report'));
 perform public.messaging('block','{"user_id":"00000000-0000-4000-a000-000000001002","blocked":true}');
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-a000-000000001002',true);
do $$begin
 begin perform public.messaging('send',jsonb_build_object('thread_id',current_setting('inbox_test.direct'),'body','Blocked','client_id',gen_random_uuid()));raise exception 'block bypass';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-a000-000000001001',true);
do $$declare r jsonb;n integer;t uuid;begin
 perform public.messaging('activate','{"confirmed":true}');
 if exists(select 1 from public.inbox_messages where thread_id=current_setting('inbox_test.direct')::uuid)then raise exception 'admin private conversation leak';end if;
 r:=public.messaging('reports');if jsonb_array_length(r)<1 then raise exception 'reported snapshot missing';end if;
 n:=(public.messaging('announcement_preview')->>'recipients')::integer;
 r:=public.messaging('announce',jsonb_build_object('subject','Announcement integration test','body','Fixture only','expected_recipients',n,'client_id',gen_random_uuid()));
 t:=(r->>'thread_id')::uuid;perform set_config('inbox_test.announcement',t::text,true);
 r:=public.messaging('send','{"team":true,"recipient_id":"00000000-0000-4000-a000-000000001003","body":"Team test","client_id":"00000000-0000-4000-a000-000000002003"}');
 perform set_config('inbox_test.team',r->>'thread_id',true);
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-a000-000000001003',true);
do $$declare r jsonb;begin
 r:=public.messaging('thread',jsonb_build_object('thread_id',current_setting('inbox_test.team')));
 if not(r->'messages'->0->>'from_team')::boolean then raise exception 'team badge';end if;
 begin perform public.messaging('send',jsonb_build_object('thread_id',current_setting('inbox_test.announcement'),'body','Reply all','client_id',gen_random_uuid()));raise exception 'broadcast reply all';exception when raise_exception then if sqlerrm='broadcast reply all' then raise;end if;end;
 perform public.messaging('send',jsonb_build_object('thread_id',current_setting('inbox_test.team'),'body','Private team reply','client_id',gen_random_uuid()));
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-a000-000000001005',true);
do $$begin
 if (public.messaging('status')->>'eligible')::boolean then raise exception 'minor eligible';end if;
 begin perform public.messaging('activate','{"confirmed":true}');raise exception 'minor activation';exception when insufficient_privilege then null;end;
 if (select count(*)from public.inbox_messages)<>0 then raise exception 'minor RLS';end if;
end $$;
set local role anon;
do $$begin
 begin perform public.messaging('status');raise exception 'anonymous access';exception when insufficient_privilege then null;end;
end $$;
rollback;
select 'Messaging integration assertions passed; fixtures rolled back.' as result;
