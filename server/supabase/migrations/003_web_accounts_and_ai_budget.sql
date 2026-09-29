-- Run after 001 and 002. Profile/trips sync without storing photos or raw session files.
create table if not exists public.web_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}',
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  constraint web_workspace_size check (octet_length(payload::text) <= 524288)
);
alter table public.web_workspaces enable row level security;
-- API writes use the server service role. Browser users cannot bypass validation.
revoke all on public.web_workspaces from anon, authenticated;
grant select, insert, update, delete on public.web_workspaces to service_role;

create table if not exists public.ai_usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null, -- Retain budget counts even if an account is deleted.
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_time_idx on public.ai_usage_events(created_at);
create index if not exists ai_usage_user_time_idx on public.ai_usage_events(user_id, created_at);
alter table public.ai_usage_events enable row level security;
revoke all on public.ai_usage_events from anon, authenticated;

create or replace function public.consume_ai_quota(
  p_user uuid, p_ip_hash text,
  p_user_day integer, p_user_month integer, p_ip_day integer,
  p_global_day integer, p_global_month integer, p_cooldown integer
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  now_utc timestamptz := clock_timestamp();
  day_start timestamptz := date_trunc('day', now_utc at time zone 'UTC') at time zone 'UTC';
  month_start timestamptz := date_trunc('month', now_utc at time zone 'UTC') at time zone 'UTC';
  last_call timestamptz;
  gd bigint; gm bigint; ud bigint; um bigint; ipd bigint;
  retry integer;
begin
  if p_user is null or least(p_user_day,p_user_month,p_ip_day,p_global_day,p_global_month,p_cooldown) < 1 then
    raise exception 'Invalid AI budget configuration';
  end if;
  -- One transaction lock prevents concurrent requests, processes and restarts bypassing caps.
  perform pg_advisory_xact_lock(72461823);
  now_utc := clock_timestamp();
  day_start := date_trunc('day', now_utc at time zone 'UTC') at time zone 'UTC';
  month_start := date_trunc('month', now_utc at time zone 'UTC') at time zone 'UTC';
  delete from public.ai_usage_events where created_at < now_utc - interval '35 days';
  select max(created_at) into last_call from public.ai_usage_events where user_id = p_user;
  if last_call > now_utc - make_interval(secs => p_cooldown) then
    return jsonb_build_object('allowed',false,'retryAfter',greatest(1,ceil(extract(epoch from last_call + make_interval(secs => p_cooldown) - now_utc))));
  end if;
  select count(*) filter(where created_at >= day_start), count(*),
    count(*) filter(where user_id=p_user and created_at>=day_start),
    count(*) filter(where user_id=p_user),
    count(*) filter(where ip_hash=p_ip_hash and created_at>=day_start)
  into gd,gm,ud,um,ipd from public.ai_usage_events where created_at>=month_start;
  if gm>=p_global_month or um>=p_user_month then
    retry := ceil(extract(epoch from month_start + interval '1 month' - now_utc));
  elsif gd>=p_global_day or ud>=p_user_day or ipd>=p_ip_day then
    retry := ceil(extract(epoch from day_start + interval '1 day' - now_utc));
  else
    -- Count before provider invocation; errors count too. No automatic paid retries.
    insert into public.ai_usage_events(user_id,ip_hash) values(p_user,p_ip_hash);
    return jsonb_build_object('allowed',true);
  end if;
  return jsonb_build_object('allowed',false,'retryAfter',greatest(1,retry));
end $$;
revoke all on function public.consume_ai_quota(uuid,text,integer,integer,integer,integer,integer,integer) from public;
grant execute on function public.consume_ai_quota(uuid,text,integer,integer,integer,integer,integer,integer) to service_role;
