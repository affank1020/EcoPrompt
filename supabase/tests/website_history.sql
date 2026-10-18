-- Run after weekly_leaderboard.sql in the SAME disposable local database only.
-- No migrations are changed. Verify the website metadata fits the authoritative schema.
\set ON_ERROR_STOP on
set role authenticated;
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
insert into public.estimates(user_id, site, source, model, prompt_chars, tokens, complexity,
 water_ml, low_ml, high_ml, energy_wh, energy_low_wh, energy_high_wh, methodology, compressed, tokens_saved)
values
 (auth.uid(), 'HydroPrompt', 'web', null, 14, 7, 'easy', 2, 2, 2, 3, 3, 3, 'backend-token-v1', false, null),
 (auth.uid(), 'HydroPrompt', 'bulk', 'display-model', 1, 401, null, 2, 1, 5, 3, 1.5, 7.5, 'website-mock-v1', false, null);
do $$ begin
  if (select count(*) from public.estimates where site = 'HydroPrompt') <> 2 then raise exception 'Website history missing'; end if;
  if exists(select 1 from public.weekly_leaderboard_v1() where prompts <> 10 or total_ml <> 20 or total_wh <> 30)
    then raise exception 'Website methods contaminated leaderboard'; end if;
  begin
    insert into public.estimates(user_id, site, source, prompt_chars, tokens, water_ml, low_ml, high_ml, energy_wh, energy_low_wh, energy_high_wh)
    values ('20000000-0000-0000-0000-000000000002', 'HydroPrompt', 'web', 1, 1, 1, 1, 1, 1, 1, 1);
    raise exception 'Cross-user insertion allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claim.sub = '20000000-0000-0000-0000-000000000002';
do $$ begin
  if exists(select 1 from public.estimates where site = 'HydroPrompt') then raise exception 'Website rows leaked'; end if;
end $$;
reset role;
select 'Website history schema, RLS and methodology isolation passed' as result;
