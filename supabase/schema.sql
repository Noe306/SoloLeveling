-- ============================================================================
-- SoloLeveling app: accounts + cloud saves.
-- Run ONCE in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to share publicly: it contains no keys or passwords.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. PROFILES: one row per account, holding the unique, fixed username.
--    Rules: 3-20 characters, letters / digits / underscore, unique ignoring
--    upper/lower case ("Noe" and "noe" are the same name).
-- ---------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null,
  created_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[A-Za-z0-9_]{3,20}$')
);
create unique index profiles_username_lower_idx on public.profiles (lower(username));

alter table public.profiles enable row level security;
-- A player can read only their own profile. There is deliberately NO insert /
-- update policy: profiles are created by the trigger below and usernames are fixed.
create policy "profiles: read own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

-- Create the profile automatically when an account is created.
-- The app sends the username in the sign-up metadata. If the username is
-- invalid or already taken, this fails and the whole sign-up is cancelled.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data ->> 'username');
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- "Is this username free?" for the sign-up form. Returns only true/false.
create function public.username_available(name text)
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(name));
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- Username -> account id, used ONLY by the login Edge Function (server side).
-- Nobody using the app can call it, so emails can never be discovered from usernames.
create function public.user_id_for_username(name text)
returns uuid
language sql stable
security definer set search_path = ''
as $$
  select id from public.profiles where lower(username) = lower(name);
$$;
revoke execute on function public.user_id_for_username(text) from public, anon, authenticated;
grant execute on function public.user_id_for_username(text) to service_role;

-- ---------------------------------------------------------------------------
-- 2. SAVES: one cloud save per account (the whole game state as JSON).
-- ---------------------------------------------------------------------------
create table public.saves (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;
-- Each player can read, create and update ONLY their own save.
create policy "saves: read own" on public.saves
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "saves: insert own" on public.saves
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "saves: update own" on public.saves
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
