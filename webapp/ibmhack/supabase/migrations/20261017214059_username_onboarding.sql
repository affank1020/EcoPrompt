-- Username onboarding: Google sign-ups get a placeholder username ('user_' + first 8
-- hex chars of their id) and are sent to /welcome until they pick their own.
-- Runs as one transaction, so if the check constraint fails nothing is applied.

begin;

-- 1. Track whether the user chose their username
alter table public.profiles
  add column if not exists username_set boolean not null default false;

-- Existing users with a real username don't need onboarding
update public.profiles
set username_set = true
where username !~ '^user_[0-9a-f]{8}$';

-- 2. Mark usernames given at signup as chosen. The username is trimmed and
-- lowercased, and one that breaks the format rule falls back to the placeholder
-- (so the user is onboarded) instead of failing the signup.
-- NOTE: compare with your current definition before running, and keep any other
-- columns it sets:  select pg_get_functiondef('public.handle_new_user'::regproc);
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := lower(btrim(new.raw_user_meta_data ->> 'username'));
  chosen boolean := coalesce(requested ~ '^[a-z0-9_]{3,20}$', false);
begin
  insert into public.profiles (id, username, display_name, username_set)
  values (
    new.id,
    case when chosen then requested else 'user_' || left(new.id::text, 8) end,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name'
    ),
    chosen
  );
  return new;
end;
$$;

-- 3. Format rule, matching the /welcome form and server action.
-- The placeholder already satisfies it: 'user_' + 8 hex chars is 13 characters
-- of [a-z0-9_]. Any existing row with uppercase letters, other characters, or
-- fewer than 3 / more than 20 characters makes this fail; see the query below.
alter table public.profiles
  add constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$');

commit;

-- Rows that would break the constraint (run before the migration to check):
-- select id, username from public.profiles where username !~ '^[a-z0-9_]{3,20}$';
