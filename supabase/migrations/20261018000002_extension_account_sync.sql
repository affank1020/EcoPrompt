-- Non-destructive adaptation of Ghiles baseline. Back up and review existing schema first.
-- No DROP TABLE; existing rows and auth users are retained.
begin;

-- One profile per auth user, made by handle_new_user
create table if not exists public.profiles (
  id uuid primary key
    references auth.users (id) on delete cascade,
  username text not null unique
    constraint profiles_username_format
    check (username ~ '^[a-z0-9_]{3,20}$'),
  username_set boolean not null default false,
  display_name text,
  avatar_url text,
  show_on_leaderboard boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists username_set boolean not null default false;

-- One row per submitted prompt usage estimate. Savings stay in the extension ledger.
-- Never the prompt text: lengths and numbers only.
create table if not exists public.estimates (
  -- Clients may supply the id so retries never duplicate
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
    constraint estimates_created_at_not_future
    check (created_at <= now() + interval '5 minutes'),
  site text not null,
  model text,
  source text not null
    check (source in ('extension', 'web', 'bulk')),
  prompt_chars integer not null check (prompt_chars >= 0),
  tokens integer not null check (tokens >= 0),
  complexity text
    check (complexity in ('easy', 'medium', 'hard')),
  water_ml real not null,
  low_ml real not null,
  high_ml real not null,
  energy_wh real not null,
  energy_low_wh real not null,
  energy_high_wh real not null,
  compressed boolean not null default false,
  tokens_saved integer check (tokens_saved >= 0)
);

create index if not exists estimates_user_created_idx
  on public.estimates (user_id, created_at desc);

alter table public.estimates add column if not exists methodology text not null default 'legacy-unspecified';

-- Row level security
alter table public.profiles enable row level security;
alter table public.estimates enable row level security;

revoke all on public.profiles, public.estimates from anon;

drop policy if exists "Signed-in users can read profiles" on public.profiles;
create policy "Signed-in users can read profiles"
  on public.profiles for select to authenticated
  using (true);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Only these columns are editable
revoke update on public.profiles from authenticated;
grant update (
  username,
  username_set,
  display_name,
  avatar_url,
  show_on_leaderboard
) on public.profiles to authenticated;

drop policy if exists "Users can read their own estimates" on public.estimates;
create policy "Users can read their own estimates"
  on public.estimates for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can add their own estimates" on public.estimates;
create policy "Users can add their own estimates"
  on public.estimates for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their own estimates" on public.estimates;
create policy "Users can delete their own estimates"
  on public.estimates for delete to authenticated
  using (user_id = auth.uid());

-- Creates a profile for each new user.
-- Uses the signup username if valid and free.
-- Otherwise falls back to user_ plus 8 chars of the id.
-- Must never raise: an error here blocks the signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted text := lower(new.raw_user_meta_data ->> 'username');
  ok boolean := coalesce(
    wanted ~ '^[a-z0-9_]{3,20}$'
      and not exists (
        select 1 from public.profiles where username = wanted
      ),
    false
  );
begin
  insert into public.profiles (
    id,
    username,
    username_set,
    display_name,
    avatar_url
  )
  values (
    new.id,
    case
      when ok then wanted
      else 'user_' || left(replace(new.id::text, '-', ''), 8)
    end,
    ok,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name'
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profiles for users who signed up before the trigger.
-- They get sent to /welcome to pick a username.
insert into public.profiles (
  id,
  username,
  display_name,
  avatar_url
)
select
  id,
  'user_' || left(replace(id::text, '-', ''), 8),
  coalesce(
    raw_user_meta_data ->> 'display_name',
    raw_user_meta_data ->> 'full_name'
  ),
  raw_user_meta_data ->> 'avatar_url'
from auth.users
on conflict (id) do nothing;

grant select, insert, delete on public.estimates to authenticated;
grant select on public.profiles to authenticated;

commit;
