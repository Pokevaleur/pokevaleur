-- Additive inbox, independent of community/trade messages and collection data.
create schema if not exists pokevaleur_private;
revoke all on schema pokevaleur_private from public, anon;
grant usage on schema pokevaleur_private to authenticated;

create table public.inbox_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 adult_confirmed_at timestamptz not null default now(),
 allow_direct boolean not null default true
);
create table public.inbox_threads (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('direct','team','announcement')),
 subject text not null check(char_length(subject) between 1 and 120),
 member_a uuid references auth.users(id) on delete cascade,
 member_b uuid references auth.users(id) on delete cascade,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check ((kind='direct' and member_a is not null and member_b is not null and member_a<member_b)
     or (kind='team' and member_a is not null and member_b is null)
     or (kind='announcement' and member_a is null and member_b is null))
);
create unique index inbox_direct_pair on public.inbox_threads(member_a,member_b) where kind='direct';
create unique index inbox_team_member on public.inbox_threads(member_a) where kind='team';
create index inbox_threads_member_b on public.inbox_threads(member_b);
create index inbox_threads_created_by on public.inbox_threads(created_by,created_at desc);
create index inbox_threads_recent on public.inbox_threads(updated_at desc);
create table public.inbox_participants (
 thread_id uuid not null references public.inbox_threads(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 last_read_id bigint not null default 0,
 archived_at timestamptz,
 primary key(thread_id,user_id)
);
create index inbox_participants_user on public.inbox_participants(user_id,thread_id);
create table public.inbox_messages (
 id bigint generated always as identity primary key,
 thread_id uuid not null references public.inbox_threads(id) on delete cascade,
 sender_id uuid references auth.users(id) on delete set null,
 sender_name text not null,
 from_team boolean not null default false,
 body text not null check(char_length(btrim(body)) between 1 and 4000),
 client_id uuid not null,
 created_at timestamptz not null default now(),
 unique(sender_id,client_id)
);
create index inbox_messages_thread on public.inbox_messages(thread_id,id desc);
create index inbox_messages_sender_date on public.inbox_messages(sender_id,created_at desc);
create table public.inbox_blocks (
 blocker_id uuid not null references auth.users(id) on delete cascade,
 blocked_id uuid not null references auth.users(id) on delete cascade,
 primary key(blocker_id,blocked_id),
 check(blocker_id<>blocked_id)
);
create index inbox_blocks_blocked on public.inbox_blocks(blocked_id,blocker_id);
create table public.inbox_reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid references auth.users(id) on delete set null,
 message_id bigint references public.inbox_messages(id) on delete set null,
 reason text not null check(char_length(btrim(reason)) between 3 and 1000),
 snapshot jsonb not null,
 resolved_at timestamptz,
 created_at timestamptz not null default now(),
 unique(reporter_id,message_id)
);

create index inbox_reports_message on public.inbox_reports(message_id);

-- Age/role authorization never trusts editable user_metadata.
create function pokevaleur_private.inbox_eligible(p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select p_user is not null and exists(select 1 from public.profiles p join auth.users u on u.id=p.id
 where p.id=p_user and not coalesce(u.is_anonymous,false))
 and not exists(select 1 from public.social_access_consents c where c.user_id=p_user
 and (c.age_band='under_15' or c.parent_user_id is not null));
$$;
create function pokevaleur_private.inbox_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(select 1 from public.profiles where id=(select auth.uid()) and is_admin=true);
$$;
create function pokevaleur_private.inbox_allowed() returns boolean
language sql stable security definer set search_path='' as $$
 select pokevaleur_private.inbox_eligible((select auth.uid())) and exists(
 select 1 from public.inbox_preferences where user_id=(select auth.uid()));
$$;
create function pokevaleur_private.inbox_can_read(p_thread uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select pokevaleur_private.inbox_allowed() and exists(select 1 from public.inbox_threads t
 where t.id=p_thread and (exists(select 1 from public.inbox_participants p
 where p.thread_id=t.id and p.user_id=(select auth.uid()))
 or (t.kind='team' and pokevaleur_private.inbox_admin())));
$$;

alter table public.inbox_preferences enable row level security;
alter table public.inbox_threads enable row level security;
alter table public.inbox_participants enable row level security;
alter table public.inbox_messages enable row level security;
alter table public.inbox_blocks enable row level security;
alter table public.inbox_reports enable row level security;
revoke all on public.inbox_preferences,public.inbox_threads,public.inbox_participants,
 public.inbox_messages,public.inbox_blocks,public.inbox_reports from public,anon,authenticated;
grant select on public.inbox_preferences,public.inbox_threads,public.inbox_participants,
 public.inbox_messages,public.inbox_blocks to authenticated;
grant all on public.inbox_preferences,public.inbox_threads,public.inbox_participants,
 public.inbox_messages,public.inbox_blocks,public.inbox_reports to service_role;
create policy inbox_preferences_self on public.inbox_preferences for select to authenticated
 using(user_id=(select auth.uid()) and pokevaleur_private.inbox_allowed());
create policy inbox_threads_participant on public.inbox_threads for select to authenticated
 using(pokevaleur_private.inbox_can_read(id));
create policy inbox_participants_self on public.inbox_participants for select to authenticated
 using(user_id=(select auth.uid()) and pokevaleur_private.inbox_can_read(thread_id));
create policy inbox_messages_participant on public.inbox_messages for select to authenticated
 using(pokevaleur_private.inbox_can_read(thread_id));
create policy inbox_blocks_self on public.inbox_blocks for select to authenticated
 using(blocker_id=(select auth.uid()) and pokevaleur_private.inbox_allowed());

create policy inbox_reports_api_only on public.inbox_reports for all to authenticated
 using(false) with check(false);

-- All writes and bounded reads pass through an authenticated, guarded API.
-- The public wrapper is SECURITY INVOKER; the implementation stays unexposed.
create function pokevaleur_private.inbox_api(p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=(select auth.uid()); admin boolean; eligible boolean; active boolean;
 tid uuid; recipient uuid; client uuid; text_body text; title text; mode text;
 thread_row public.inbox_threads%rowtype; message_row public.inbox_messages%rowtype;
 result jsonb; n integer; expected integer; read_id bigint; before_id bigint;
 a uuid; b uuid; peer uuid; is_team boolean; actor_name text;
begin
 if actor is null then raise exception 'Connecte-toi pour accéder à la messagerie.' using errcode='42501'; end if;
 eligible:=pokevaleur_private.inbox_eligible(actor);
 active:=eligible and exists(select 1 from public.inbox_preferences where user_id=actor);
 admin:=pokevaleur_private.inbox_admin();
 if p_action='status' then
  select count(*) into n from public.inbox_messages m join public.inbox_threads t on t.id=m.thread_id
  left join public.inbox_participants p on p.thread_id=t.id and p.user_id=actor
  where active and (p.user_id=actor or (admin and t.kind='team'))
  and m.id>coalesce(p.last_read_id,0) and m.sender_id is distinct from actor;
  return jsonb_build_object('eligible',eligible,'active',active,'is_admin',admin,'unread',n,
  'allow_direct',coalesce((select allow_direct from public.inbox_preferences where user_id=actor),true));
 end if;
 if not eligible then raise exception 'La messagerie est réservée au titulaire majeur du compte. Les profils enfants ne peuvent pas y accéder.' using errcode='42501'; end if;
 if p_action='activate' then
  if coalesce((p_payload->>'confirmed')::boolean,false) is not true then
   raise exception 'Confirme être majeur et titulaire de ce compte.' using errcode='22023'; end if;
  insert into public.inbox_preferences(user_id) values(actor) on conflict(user_id) do nothing;
  return jsonb_build_object('active',true);
 end if;
 if not active then raise exception 'Confirme d’abord être majeur et titulaire de ce compte.' using errcode='42501'; end if;
 if p_action='members' then
  select coalesce(jsonb_agg(x),'[]'::jsonb) into result from (
   select p.id,p.display_name,p.avatar_key,p.is_admin from public.profiles p
   where p.id<>actor and pokevaleur_private.inbox_eligible(p.id)
   and coalesce((select allow_direct from public.inbox_preferences where user_id=p.id),true)
   and position(lower(left(coalesce(p_payload->>'search',''),50)) in lower(coalesce(p.display_name,'Collectionneur')))>0
   and not exists(select 1 from public.inbox_blocks b where (b.blocker_id=actor and b.blocked_id=p.id) or(b.blocker_id=p.id and b.blocked_id=actor))
   order by lower(p.display_name),p.id limit 40
  )x; return result;
 elsif p_action='inbox' then
  select coalesce(jsonb_agg(x order by x.updated_at desc),'[]'::jsonb) into result from (
   select t.id,t.kind,t.subject,t.updated_at,
    case when t.kind='direct' then coalesce(peer_p.display_name,'Membre supprimé')
     when t.kind='team' and admin then coalesce(owner_p.display_name,'Membre supprimé') else 'Équipe PokéValeur' end as correspondent,
    coalesce(p.archived_at is not null,false) as archived,
    (select left(body,130) from public.inbox_messages where thread_id=t.id order by id desc limit 1) as preview,
    (select count(*) from public.inbox_messages m where m.thread_id=t.id and m.id>coalesce(p.last_read_id,0) and m.sender_id is distinct from actor) as unread
   from public.inbox_threads t left join public.inbox_participants p on p.thread_id=t.id and p.user_id=actor
   left join public.profiles peer_p on peer_p.id=case when t.member_a=actor then t.member_b else t.member_a end
   left join public.profiles owner_p on owner_p.id=t.member_a
   where (p.user_id=actor or (admin and t.kind='team'))
   and coalesce(p.archived_at is not null,false)=coalesce((p_payload->>'archived')::boolean,false)
   order by t.updated_at desc limit 100
  )x; return result;
 elsif p_action in ('thread','read','archive') then
  tid:=(p_payload->>'thread_id')::uuid;
  if not pokevaleur_private.inbox_can_read(tid) then raise exception 'Conversation inaccessible.' using errcode='42501'; end if;
  select * into thread_row from public.inbox_threads where id=tid;
  if p_action='archive' then
   insert into public.inbox_participants(thread_id,user_id,archived_at) values(tid,actor,case when (p_payload->>'archived')::boolean then now() else null end)
   on conflict(thread_id,user_id) do update set archived_at=excluded.archived_at;
   return jsonb_build_object('ok',true);
  elsif p_action='read' then
   read_id:=(p_payload->>'last_id')::bigint;
   if not exists(select 1 from public.inbox_messages where id=read_id and thread_id=tid) then raise exception 'Message introuvable.'; end if;
   insert into public.inbox_participants(thread_id,user_id,last_read_id)values(tid,actor,read_id)
   on conflict(thread_id,user_id) do update set last_read_id=greatest(public.inbox_participants.last_read_id,excluded.last_read_id);
   return jsonb_build_object('ok',true);
  end if;
  before_id:=coalesce((p_payload->>'before_id')::bigint,9223372036854775807);
  select coalesce(jsonb_agg(x order by x.id),'[]'::jsonb) into result from (
   select id,sender_id,sender_name,from_team,body,created_at from public.inbox_messages
   where thread_id=tid and id<before_id order by id desc limit 50
  )x;
  peer:=case when thread_row.member_a=actor then thread_row.member_b else thread_row.member_a end;
  return jsonb_build_object('thread',to_jsonb(thread_row)-'member_a'-'member_b'-'created_by','messages',result,
   'peer_id',case when thread_row.kind='direct' then peer else null end,
   'blocked',exists(select 1 from public.inbox_blocks where blocker_id=actor and blocked_id=peer),
   'cannot_send',thread_row.kind='announcement' or (thread_row.kind='direct' and (
     not pokevaleur_private.inbox_eligible(peer) or
     not coalesce((select allow_direct from public.inbox_preferences where user_id=peer),true) or
     exists(select 1 from public.inbox_blocks where (blocker_id=actor and blocked_id=peer)or(blocker_id=peer and blocked_id=actor)))));
 elsif p_action='preferences' then
  update public.inbox_preferences set allow_direct=coalesce((p_payload->>'allow_direct')::boolean,allow_direct) where user_id=actor;
  return jsonb_build_object('ok',true);
 elsif p_action='blocks' then
  select coalesce(jsonb_agg(x),'[]'::jsonb)into result from(
  select b.blocked_id,p.display_name from public.inbox_blocks b join public.profiles p on p.id=b.blocked_id where b.blocker_id=actor)x; return result;
 elsif p_action='block' then
  recipient:=(p_payload->>'user_id')::uuid;
  if recipient=actor or not exists(select 1 from public.profiles where id=recipient) then raise exception 'Membre invalide.'; end if;
  if coalesce((p_payload->>'blocked')::boolean,true) then
   insert into public.inbox_blocks values(actor,recipient)on conflict do nothing;
  else delete from public.inbox_blocks where blocker_id=actor and blocked_id=recipient; end if;
  return jsonb_build_object('ok',true);
 elsif p_action='report' then
  select * into message_row from public.inbox_messages where id=(p_payload->>'message_id')::bigint;
  if not found or message_row.sender_id=actor or not pokevaleur_private.inbox_can_read(message_row.thread_id) then raise exception 'Message inaccessible.' using errcode='42501'; end if;
  text_body:=btrim(coalesce(p_payload->>'reason',''));
  if char_length(text_body) not between 3 and 1000 then raise exception 'Indique un motif entre 3 et 1 000 caractères.'; end if;
  insert into public.inbox_reports(reporter_id,message_id,reason,snapshot)values(actor,message_row.id,text_body,
   jsonb_build_object('sender',message_row.sender_name,'body',message_row.body,'date',message_row.created_at))on conflict(reporter_id,message_id) do nothing;
  return jsonb_build_object('ok',true);
 elsif p_action='reports' then
  if not admin then raise exception 'Accès administrateur requis.' using errcode='42501'; end if;
  select coalesce(jsonb_agg(x),'[]'::jsonb)into result from(select id,reason,snapshot,created_at,resolved_at from public.inbox_reports order by created_at desc limit 100)x;return result;
 elsif p_action='resolve_report' then
  if not admin then raise exception 'Accès administrateur requis.' using errcode='42501'; end if;
  update public.inbox_reports set resolved_at=now() where id=(p_payload->>'report_id')::uuid;
  return jsonb_build_object('ok',true);
 elsif p_action='announcement_preview' then
  if not admin then raise exception 'Accès administrateur requis.' using errcode='42501'; end if;
  select count(*)into n from public.profiles where id<>actor and pokevaleur_private.inbox_eligible(id);
  return jsonb_build_object('recipients',n);
 elsif p_action not in ('send','announce') then
  raise exception 'Action inconnue.' using errcode='22023';
 end if;

 -- Serialized per sender: retries cannot create duplicate messages or bypass limits.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text,0));
 client:=(p_payload->>'client_id')::uuid;
 if client is null then raise exception 'Identifiant du message manquant.'; end if;
 select thread_id into tid from public.inbox_messages where sender_id=actor and client_id=client;
 if found then return jsonb_build_object('thread_id',tid); end if;
 text_body:=btrim(coalesce(p_payload->>'body',''));
 title:=btrim(coalesce(p_payload->>'subject',''));
 if char_length(text_body) not between 1 and 4000 then raise exception 'Le message doit contenir entre 1 et 4 000 caractères.'; end if;
 if char_length(title)>120 then raise exception 'Le titre est limité à 120 caractères.'; end if;
 if (select count(*)from public.inbox_messages where sender_id=actor and created_at>now()-interval '1 minute')>=15
 or (select count(*)from public.inbox_messages where sender_id=actor and created_at>now()-interval '1 day')>=200 then
  raise exception 'Trop de messages envoyés. Patiente avant de réessayer.' using errcode='P0001'; end if;
 select coalesce(nullif(btrim(display_name),''),'Collectionneur')into actor_name from public.profiles where id=actor;
 if p_action='announce' then
  if not admin then raise exception 'Accès administrateur requis.' using errcode='42501'; end if;
  if title='' then raise exception 'Ajoute un titre à ton annonce.'; end if;
  if (select count(*) from public.inbox_threads where kind='announcement' and created_by=actor and created_at>now()-interval '1 day')>=5 then raise exception 'La limite de cinq annonces par jour est atteinte.'; end if;
  select count(*)into n from public.profiles where id<>actor and pokevaleur_private.inbox_eligible(id);
  expected:=(p_payload->>'expected_recipients')::integer;
  if expected is null or expected<>n then raise exception 'La liste des destinataires a changé. Vérifie à nouveau l’aperçu.'; end if;
  if n=0 then raise exception 'Aucun autre membre destinataire pour le moment.'; end if;
  insert into public.inbox_threads(kind,subject,created_by)values('announcement',title,actor)returning id into tid;
  insert into public.inbox_participants(thread_id,user_id)select tid,id from public.profiles where pokevaleur_private.inbox_eligible(id);
  is_team:=true;
 else
  tid:=(p_payload->>'thread_id')::uuid;
  if tid is not null then
   if not pokevaleur_private.inbox_can_read(tid)then raise exception 'Conversation inaccessible.' using errcode='42501'; end if;
   select * into thread_row from public.inbox_threads where id=tid;
   if thread_row.kind='announcement' then raise exception 'Réponds à l’équipe en privé.'; end if;
   recipient:=case when thread_row.member_a=actor then thread_row.member_b else thread_row.member_a end;
   mode:=thread_row.kind;
  else
   recipient:=(p_payload->>'recipient_id')::uuid;
   if coalesce((p_payload->>'team')::boolean,false)then
    mode:='team';
    if not admin or recipient is null then recipient:=actor; end if;
    if not pokevaleur_private.inbox_eligible(recipient)then raise exception 'Membre inaccessible.'; end if;
    insert into public.inbox_threads(kind,subject,member_a,created_by) values('team','Échange avec l’équipe',recipient,actor)
    on conflict(member_a)where kind='team' do update set updated_at=now()returning id into tid;
    insert into public.inbox_participants(thread_id,user_id)values(tid,recipient)on conflict do nothing;
   else
    mode:='direct';
    if recipient is null or recipient=actor or not pokevaleur_private.inbox_eligible(recipient)then raise exception 'Choisis un autre membre titulaire de compte.'; end if;
    if title='' then title:='Conversation'; end if;
    a:=least(actor,recipient);b:=greatest(actor,recipient);
    insert into public.inbox_threads(kind,subject,member_a,member_b,created_by)values('direct',title,a,b,actor)
    on conflict(member_a,member_b)where kind='direct' do update set updated_at=now()returning id into tid;
    insert into public.inbox_participants(thread_id,user_id)values(tid,a),(tid,b)on conflict do nothing;
   end if;
  end if;
  if mode='direct' and (not pokevaleur_private.inbox_eligible(recipient)
   or not coalesce((select allow_direct from public.inbox_preferences where user_id=recipient),true)
   or exists(select 1 from public.inbox_blocks where(blocker_id=actor and blocked_id=recipient)or(blocker_id=recipient and blocked_id=actor)))then
   raise exception 'L’envoi de messages à ce membre est indisponible.' using errcode='42501';end if;
  is_team:=mode='team' and admin;
 end if;
 insert into public.inbox_messages(thread_id,sender_id,sender_name,from_team,body,client_id)
 values(tid,actor,case when is_team then 'Équipe PokéValeur' else actor_name end,is_team,text_body,client);
 update public.inbox_threads set updated_at=now()where id=tid;
 update public.inbox_participants set archived_at=null where thread_id=tid;
 return jsonb_build_object('thread_id',tid);
end;
$$;

create function public.messaging(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select pokevaleur_private.inbox_api(p_action,coalesce(p_payload,'{}'::jsonb));
$$;
revoke all on function pokevaleur_private.inbox_eligible(uuid),pokevaleur_private.inbox_admin(),
 pokevaleur_private.inbox_allowed(),pokevaleur_private.inbox_can_read(uuid),
 pokevaleur_private.inbox_api(text,jsonb) from public,anon,authenticated;
grant execute on function pokevaleur_private.inbox_allowed(),pokevaleur_private.inbox_can_read(uuid),pokevaleur_private.inbox_api(text,jsonb)to authenticated;
revoke all on function public.messaging(text,jsonb)from public,anon;
grant execute on function public.messaging(text,jsonb)to authenticated;
