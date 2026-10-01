CREATE OR REPLACE FUNCTION public.open_daily_chest()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_user uuid:=auth.uid(); v_today date:=(now() at time zone 'Europe/Paris')::date; v_day bigint;
 v_existing public.chest_openings%rowtype; v_reward public.daily_chest_rewards%rowtype; v_partner public.partner_rewards%rowtype; v_total int; v_count int;
begin
 if v_user is null then raise exception 'authentication required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('daily_chest:'||v_user::text,0));
 select * into v_existing from public.chest_openings where user_id=v_user and opened_on=v_today;
 if found then
   select coalesce(xp,0) into v_total from public.member_progress where user_id=v_user;
   if v_existing.reward_type='partner' then
     select * into v_partner from public.partner_rewards where id=v_existing.partner_reward_id;
     return jsonb_build_object('opened',false,'already_opened',true,'reward_type','partner','reward_key',v_existing.reward_key,'icon','🎁','label','Cadeau partenaire','title',coalesce(v_partner.title,'Cadeau partenaire'),'body',coalesce(v_partner.description,'Une récompense offerte par un partenaire.'),'xp_awarded',v_existing.xp_awarded,'total_xp',coalesce(v_total,0),'partner_available',true,'claimed',v_existing.claimed_at is not null);
   end if;
   select * into v_reward from public.daily_chest_rewards where reward_key=v_existing.reward_key;
   return jsonb_build_object('opened',false,'already_opened',true,'reward_type',v_existing.reward_type,'reward_key',v_existing.reward_key,'icon',v_reward.icon,'label',v_reward.label,'title',v_reward.title,'body',v_reward.body,'xp_awarded',v_existing.xp_awarded,'total_xp',coalesce(v_total,0),'badge_key',v_reward.badge_key);
 end if;
 v_day:=v_today-date '1970-01-01';
 if mod(v_day,31)=0 then
   select * into v_partner from public.partner_rewards where active=true and (valid_from is null or now()>=valid_from) and (valid_until is null or now()<=valid_until) and (max_claims is null or claim_count<max_claims) order by id limit 1;
 end if;
 if v_partner.id is not null then
   insert into public.chest_openings(user_id,opened_on,reward_key,reward_type,xp_awarded,partner_reward_id) values(v_user,v_today,v_partner.reward_key,'partner',1,v_partner.id);
   insert into public.member_xp_events(user_id,event_key,event_type,xp,occurred_on) values(v_user,'chest:'||v_today,'daily_chest',1,v_today) on conflict(user_id,event_key) do nothing;
   perform public.sync_member_xp(v_user);
   select xp into v_total from public.member_progress where user_id=v_user;
   return jsonb_build_object('opened',true,'already_opened',false,'reward_type','partner','reward_key',v_partner.reward_key,'icon','🎁','label','Cadeau partenaire','title',v_partner.title,'body',coalesce(v_partner.description,'Une récompense offerte par un partenaire.'),'xp_awarded',1,'total_xp',v_total,'partner_available',true,'claimed',false);
 end if;
 if mod(v_day,17)=0 then select * into v_reward from public.daily_chest_rewards where reward_key='golden';
 else
   select count(*) into v_count from public.daily_chest_rewards where active=true and reward_key<>'golden';
   select * into v_reward from public.daily_chest_rewards where active=true and reward_key<>'golden' order by sort_order offset mod(v_day,v_count) limit 1;
 end if;
 insert into public.chest_openings(user_id,opened_on,reward_key,reward_type,xp_awarded) values(v_user,v_today,v_reward.reward_key,v_reward.reward_type,(coalesce(v_reward.xp_amount,0)+1));
 if (coalesce(v_reward.xp_amount,0)+1)>0 then insert into public.member_xp_events(user_id,event_key,event_type,xp,occurred_on) values(v_user,'chest:'||v_today,'daily_chest',(coalesce(v_reward.xp_amount,0)+1),v_today) on conflict do nothing; end if;
 if v_reward.badge_key is not null then insert into public.member_badges(user_id,badge_key) values(v_user,v_reward.badge_key) on conflict do nothing; end if;
 perform public.sync_member_xp(v_user);
 select xp into v_total from public.member_progress where user_id=v_user;
 return jsonb_build_object('opened',true,'already_opened',false,'reward_type',v_reward.reward_type,'reward_key',v_reward.reward_key,'icon',v_reward.icon,'label',v_reward.label,'title',v_reward.title,'body',v_reward.body,'xp_awarded',(coalesce(v_reward.xp_amount,0)+1),'badge_key',v_reward.badge_key,'total_xp',v_total);
end $function$
;
revoke all on function public.open_daily_chest() from public, anon;
grant execute on function public.open_daily_chest() to authenticated;

