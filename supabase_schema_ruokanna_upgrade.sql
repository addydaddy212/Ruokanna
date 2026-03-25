-- Run after supabase_schema.sql
-- Dashboard -> SQL Editor -> New Query -> paste -> Run

alter table profiles add column if not exists display_name text;
alter table profiles add column if not exists product_name_preference text default 'ruokanna';
alter table profiles add column if not exists protein_target int;
alter table profiles add column if not exists carb_target int;
alter table profiles add column if not exists fat_target int;
alter table profiles add column if not exists dietary_preferences text[] default '{}';
alter table profiles add column if not exists allergies text[] default '{}';
alter table profiles add column if not exists health_conditions text[] default '{}';
alter table profiles add column if not exists cooking_skill text default 'intermediate';
alter table profiles add column if not exists time_budget_minutes int default 30;

alter table recipes add column if not exists source_type text default 'unknown';
alter table recipes add column if not exists source_domain text;
alter table recipes add column if not exists source_confidence numeric(4,2) default 0.60;
alter table recipes add column if not exists nutrition_source text default 'estimated';
alter table recipes add column if not exists cost_confidence text default 'estimated';

alter table ingredients add column if not exists canonical_name text;
alter table ingredients add column if not exists category text;
alter table ingredients add column if not exists is_pantry_staple boolean default false;
alter table ingredients add column if not exists normalized_unit text;
alter table ingredients add column if not exists normalized_quantity numeric(10,2);

alter table steps add column if not exists tooling_tags text[] default '{}';
alter table steps add column if not exists active_time_seconds int;
alter table steps add column if not exists passive_time_seconds int;

alter table user_fridge add column if not exists quantity numeric(10,2);
alter table user_fridge add column if not exists unit text;
alter table user_fridge add column if not exists expires_at timestamptz;
alter table user_fridge add column if not exists source text default 'manual';
alter table user_fridge add column if not exists last_seen_at timestamptz default now();

alter table meal_plan add column if not exists status text default 'planned' check (status in ('planned', 'cooked', 'skipped'));
alter table meal_plan add column if not exists leftover_source_recipe_id uuid references recipes on delete set null;
alter table meal_plan add column if not exists swap_reason text;

create table if not exists meal_events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  meal_plan_id uuid references meal_plan on delete cascade,
  recipe_id uuid references recipes on delete set null,
  event_type text not null check (event_type in ('planned', 'cooked', 'skipped', 'swapped', 'leftover-used')),
  event_date date not null,
  slot text check (slot in ('Breakfast', 'Lunch', 'Dinner', 'Snack')),
  notes text,
  created_at timestamptz default now()
);
alter table meal_events enable row level security;
drop policy if exists "Users manage own meal events" on meal_events;
create policy "Users manage own meal events" on meal_events
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists recipe_matches (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  recipe_id uuid references recipes on delete cascade not null,
  fridge_signature text not null,
  match_score int not null default 0,
  explanation text[] default '{}',
  created_at timestamptz default now()
);
alter table recipe_matches enable row level security;
drop policy if exists "Users manage own recipe matches" on recipe_matches;
create policy "Users manage own recipe matches" on recipe_matches
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists recipe_extractions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade,
  source_url text,
  source_type text,
  source_domain text,
  provider_used text,
  confidence numeric(4,2),
  latency_ms int,
  raw_input text,
  normalized_output jsonb,
  failure_reason text,
  created_at timestamptz default now()
);
alter table recipe_extractions enable row level security;
drop policy if exists "Users manage own recipe extractions" on recipe_extractions;
create policy "Users manage own recipe extractions" on recipe_extractions
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
