-- Run this entire file in your Supabase SQL Editor
-- Dashboard → SQL Editor → New Query → paste → Run

-- Profiles (extends Supabase auth.users)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  goal text default 'maintain' check (goal in ('cut', 'maintain', 'bulk')),
  calorie_target int,
  updated_at timestamptz default now()
);
alter table profiles enable row level security;
drop policy if exists "Users can manage own profile" on profiles;
create policy "Users can manage own profile" on profiles
  using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer
set search_path = public;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Recipes
create table recipes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  description text,
  source_url text,
  image_url text,
  cuisine text,
  difficulty text default 'Medium',
  prep_time int default 0,
  cook_time int default 0,
  servings int default 2,
  calories int default 0,
  protein int default 0,
  carbs int default 0,
  fat int default 0,
  cost_estimate numeric(6,2) default 0,
  goals text[] default '{}',
  created_at timestamptz default now()
);
alter table recipes enable row level security;
create policy "Users manage own recipes" on recipes
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Ingredients
create table ingredients (
  id uuid default gen_random_uuid() primary key,
  recipe_id uuid references recipes on delete cascade not null,
  name text not null,
  quantity text,
  unit text,
  calories int default 0
);
alter table ingredients enable row level security;
create policy "Ingredients via recipe ownership" on ingredients
  using (exists (select 1 from recipes where recipes.id = ingredients.recipe_id and recipes.user_id = auth.uid()));

-- Steps
create table steps (
  id uuid default gen_random_uuid() primary key,
  recipe_id uuid references recipes on delete cascade not null,
  order_num int not null,
  instruction text not null,
  timer_seconds int
);
alter table steps enable row level security;
create policy "Steps via recipe ownership" on steps
  using (exists (select 1 from recipes where recipes.id = steps.recipe_id and recipes.user_id = auth.uid()));

-- Meal plan
create table meal_plan (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null,
  slot text not null check (slot in ('Breakfast', 'Lunch', 'Dinner', 'Snack')),
  recipe_id uuid references recipes on delete set null,
  unique(user_id, date, slot)
);
alter table meal_plan enable row level security;
create policy "Users manage own meal plan" on meal_plan
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Fridge inventory
create table user_fridge (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  ingredient_name text not null,
  added_at timestamptz default now()
);
alter table user_fridge enable row level security;
create policy "Users manage own fridge" on user_fridge
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
