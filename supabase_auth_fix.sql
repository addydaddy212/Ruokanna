-- Run this in the Supabase SQL Editor for the project backing your local app.
-- It repairs the auth.users -> profiles trigger that signup depends on.

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  goal text default 'maintain' check (goal in ('cut', 'maintain', 'bulk')),
  calorie_target int,
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can manage own profile" on public.profiles;
create policy "Users can manage own profile" on public.profiles
  using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
