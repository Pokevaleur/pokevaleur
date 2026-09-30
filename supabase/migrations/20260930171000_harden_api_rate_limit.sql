create or replace function public.check_api_rate_limit(
  p_route text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_window_start timestamptz;
  v_count integer;
begin
  -- This RPC currently serves only the booster-analysis endpoint. Reject
  -- caller-chosen keys or windows so the rate-limit table cannot be filled
  -- with arbitrary entries and clients cannot tune the endpoint's limits.
  if p_route is distinct from 'analyze-boosters'
    or p_limit is distinct from 6
    or p_window_seconds is distinct from 3600 then
    return false;
  end if;

  if v_user is null then
    return false;
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.api_rate_limits(user_id, route, window_start, request_count)
  values(v_user, p_route, v_window_start, 1)
  on conflict(user_id, route, window_start)
  do update set request_count = public.api_rate_limits.request_count + 1
  returning request_count into v_count;

  delete from public.api_rate_limits
  where window_start < now() - interval '2 days';

  return v_count <= p_limit;
end;
$$;

revoke all on function public.check_api_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.check_api_rate_limit(text, integer, integer) to authenticated;
