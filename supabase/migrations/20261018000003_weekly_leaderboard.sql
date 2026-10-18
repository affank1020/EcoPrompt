-- Prerequisite: 20261018000002_extension_account_sync.sql (including methodology).
-- Apply as the table-owning migration role. No tables, rows, policies or triggers replaced.
begin;

-- A deployed PR #6 RPC, if present, must not remain an alternate unrestricted window.
do $$ begin
  if to_regprocedure('public.weekly_leaderboard(timestamp with time zone)') is not null then
    revoke all on function public.weekly_leaderboard(timestamptz) from public, anon, authenticated;
  end if;
end $$;

create or replace function public.weekly_leaderboard_v1()
returns table (user_id uuid, username text, display_name text, prompts bigint,
  total_ml double precision, avg_ml double precision, total_wh double precision)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.username, p.display_name, count(*),
    sum(e.water_ml)::double precision, avg(e.water_ml)::double precision,
    case when count(e.energy_wh) = count(*) then sum(e.energy_wh)::double precision end
  from public.estimates e join public.profiles p on p.id = e.user_id
  where auth.uid() is not null and p.show_on_leaderboard = true
    and e.created_at > now() - interval '7 days' and e.created_at <= now()
    and e.methodology = 'ecoprompt-illustrative-v1'
    and e.water_ml >= 0 and e.water_ml < 'Infinity'::real
  group by p.id, p.username, p.display_name
$$;
revoke all on function public.weekly_leaderboard_v1() from public, anon;
grant execute on function public.weekly_leaderboard_v1() to authenticated;
commit;
