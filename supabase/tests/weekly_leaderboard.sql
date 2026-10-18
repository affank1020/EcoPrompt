-- Run ONLY in an empty disposable PostgreSQL database, never against Supabase.
\set ON_ERROR_STOP on
do $$ begin
  if not exists(select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists(select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $$;
create schema auth;
create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth, public to authenticated, anon;
\ir ../migrations/20261018000002_extension_account_sync.sql
-- Exercise the legacy overload privilege cleanup without importing destructive SQL.
create function public.weekly_leaderboard(timestamptz default now()) returns int language sql as $$ select 1 $$;
\ir ../migrations/20261018000003_weekly_leaderboard.sql
\ir ../migrations/20261018000003_weekly_leaderboard.sql
insert into auth.users(id) values
 ('10000000-0000-0000-0000-000000000001'),
 ('20000000-0000-0000-0000-000000000002'),
 ('30000000-0000-0000-0000-000000000003');
update public.profiles set show_on_leaderboard = false where id = '30000000-0000-0000-0000-000000000003';
insert into public.estimates(user_id, site, source, prompt_chars, tokens, water_ml, low_ml, high_ml,
 energy_wh, energy_low_wh, energy_high_wh, methodology)
select id, 'ChatGPT', 'extension', 10, 2, 2, 1, 5, 3, 1, 6, 'ecoprompt-illustrative-v1'
from auth.users cross join generate_series(1, 10);
-- Old, future and incompatible estimates must never affect weekly totals.
insert into public.estimates(user_id, created_at, site, source, prompt_chars, tokens, water_ml, low_ml, high_ml,
 energy_wh, energy_low_wh, energy_high_wh, methodology)
select '10000000-0000-0000-0000-000000000001', t, 'ChatGPT', 'web', 10, 2, 900, 1, 999, 900, 1, 999, m
from (values (now() - interval '8 days', 'ecoprompt-illustrative-v1'),
 (now() + interval '1 minute', 'ecoprompt-illustrative-v1'), (now(), 'legacy-unspecified')) as x(t,m);
-- Reapplying after data exists must retain all rows.
\ir ../migrations/20261018000003_weekly_leaderboard.sql
set role authenticated;
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
do $$ begin
  if (select count(*) from public.estimates) <> 13 then raise exception 'RLS exposed another user'; end if;
  if (select count(*) from public.weekly_leaderboard_v1()) <> 2 then raise exception 'Global visibility failed'; end if;
  if exists(select 1 from public.weekly_leaderboard_v1() where prompts <> 10 or total_ml <> 20 or total_wh <> 30)
    then raise exception 'Methodology/window aggregation failed'; end if;
  if has_function_privilege('anon', 'public.weekly_leaderboard_v1()', 'execute') then raise exception 'Anon access'; end if;
  if has_function_privilege('authenticated', 'public.weekly_leaderboard(timestamptz)', 'execute') then raise exception 'Legacy access'; end if;
end $$;
set request.jwt.claim.sub = '30000000-0000-0000-0000-000000000003';
do $$ begin
  if exists(select 1 from public.weekly_leaderboard_v1() where user_id = auth.uid()) then raise exception 'Opt-out ignored'; end if;
end $$;
reset request.jwt.claim.sub;
do $$ begin
  if exists(select 1 from public.weekly_leaderboard_v1()) then raise exception 'Missing identity allowed'; end if;
end $$;
reset role;
select 'Leaderboard security and repeatability checks passed' as result;
