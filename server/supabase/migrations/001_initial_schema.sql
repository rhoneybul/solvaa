-- ─────────────────────────────────────────────────────────────────────────────
-- Paddle App — Initial Schema
-- Run this in your Supabase project: SQL Editor → paste → Run
-- Or use the Supabase CLI: supabase db push
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID extension (usually already enabled in Supabase)
create extension if not exists "uuid-ossp";

-- ── profiles ─────────────────────────────────────────────────────────────────
-- One row per auth user. Created automatically on first login by the API.
create table if not exists profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text,
  display_name        text,
  skill_level         text not null default 'beginner'
                        check (skill_level in ('beginner','intermediate','advanced','expert')),
  strava_id           text,
  home_location_name  text,
  home_lat            double precision,
  home_lon            double precision,
  preferences         jsonb default '{}',   -- {"units":"metric","tempUnit":"celsius",...}
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

alter table profiles enable row level security;

create policy "Users can read own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

-- ── trips ─────────────────────────────────────────────────────────────────────
-- A planned (or completed) trip. Created from AI planner or manual setup.
create table if not exists trips (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references profiles(id) on delete cascade,
  trip_type         text not null
                      check (trip_type in ('day_paddle','multi_day','weekend','week')),
  skill_level       text,
  status            text not null default 'planned'
                      check (status in ('planned','active','completed','cancelled')),
  location_name     text,
  location_lat      double precision,
  location_lon      double precision,
  planned_date      date,
  duration_days     integer default 1,
  route_data        jsonb,    -- full route object from routeService / AI planner
  weather_snapshot  jsonb,    -- conditions at time of planning
  notes             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

alter table trips enable row level security;

create policy "Users can manage own trips"
  on trips for all using (auth.uid() = user_id);

create index trips_user_id_idx on trips(user_id);
create index trips_planned_date_idx on trips(planned_date);

-- ── paddles ───────────────────────────────────────────────────────────────────
-- A completed paddle session with GPS track and stats.
create table if not exists paddles (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references profiles(id) on delete cascade,
  trip_id           uuid references trips(id) on delete set null,
  started_at        timestamptz,
  finished_at       timestamptz,
  distance_km       double precision,
  duration_seconds  integer,
  avg_speed_knots   double precision,
  max_speed_knots   double precision,
  gps_track         jsonb,    -- [{lat, lon, ts, speed}, ...]
  weather_log       jsonb,    -- [{ts, windSpeed, waveHeight, ...}, ...]
  notes             text,
  created_at        timestamptz default now()
);

alter table paddles enable row level security;

create policy "Users can manage own paddles"
  on paddles for all using (auth.uid() = user_id);

create index paddles_user_id_idx on paddles(user_id);
create index paddles_started_at_idx on paddles(started_at);

-- ── sos_events ────────────────────────────────────────────────────────────────
-- Log every SOS trigger (manual or automatic) for safety audit trail.
create table if not exists sos_events (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references profiles(id) on delete cascade,
  paddle_id       uuid references paddles(id) on delete set null,
  triggered_at    timestamptz default now(),
  trigger_type    text check (trigger_type in ('manual','no_movement','capsize','off_route')),
  lat             double precision,
  lon             double precision,
  conditions      jsonb,    -- weather at time of SOS
  resolved_at     timestamptz,
  notes           text
);

alter table sos_events enable row level security;

create policy "Users can read own SOS events"
  on sos_events for select using (auth.uid() = user_id);

create policy "Users can insert own SOS events"
  on sos_events for insert with check (auth.uid() = user_id);

-- ── saved_routes ──────────────────────────────────────────────────────────────
-- Routes a user has bookmarked for reuse.
create table if not exists saved_routes (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references profiles(id) on delete cascade,
  name        text not null,
  location    text,
  route_data  jsonb not null,
  created_at  timestamptz default now()
);

alter table saved_routes enable row level security;

create policy "Users can manage own saved routes"
  on saved_routes for all using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper function: auto-update updated_at on any table that has it
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on profiles
  for each row execute function update_updated_at();

create trigger trips_updated_at before update on trips
  for each row execute function update_updated_at();
