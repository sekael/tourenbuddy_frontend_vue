-- RLS + RPC verification for calendar availability sync (change: calendar-availability-sync).
--
-- Same mechanism as tour_suggestion_rls.sql: impersonate seed users via the `authenticated`
-- role + request.jwt.claims sub, wrapped in a transaction and rolled back.
--
-- Run against the local stack:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/calendar_availability_rls.sql
-- A failing assertion RAISEs and aborts with a non-zero exit code.
--
-- Seed identities: Patrick 1111 (owner), Jakob 2222 (friend), Reni 3333 (NOT a friend).
-- Dates in 2030 so seed availability never collides.

\set ON_ERROR_STOP on

\set owner '11111111-1111-1111-1111-111111111111'
\set friend '22222222-2222-2222-2222-222222222222'
\set stranger '33333333-3333-3333-3333-333333333333'

begin;

-- 1 — No feed: mark + clear leaves no row (plain delete, no tombstone).
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'owner', 'role', 'authenticated')::text, true);
do $$
begin
  perform public.apply_availability_diff('{2030-01-01}', '{}');
  perform public.apply_availability_diff('{}', '{2030-01-01}');
  if exists (select 1 from public.user_availability where date = '2030-01-01') then
    raise exception '1 FAIL: clear without feed left a row';
  end if;
  raise notice '1 OK: no tombstone without a feed';
end $$;

-- 2 — With a feed: clear writes a tombstone; mark writes source = manual.
insert into public.user_calendar_feeds (user_id, url) values (:'owner', 'https://cal.example/a.ics');
do $$
declare r record;
begin
  perform public.apply_availability_diff('{2030-01-02,2030-01-04}', '{}');
  perform public.apply_availability_diff('{}', '{2030-01-02}');
  select available, source into r from public.user_availability where date = '2030-01-02';
  if r is null or r.available or r.source <> 'manual' then
    raise exception '2 FAIL: expected tombstone, got %', r;
  end if;
  raise notice '2 OK: clear with a feed tombstones';
end $$;

-- 3 — Sixth feed rejected with the named exception.
do $$
begin
  insert into public.user_calendar_feeds (user_id, url)
  select auth.uid(), 'https://cal.example/' || g || '.ics' from generate_series(1, 4) g;
  begin
    insert into public.user_calendar_feeds (user_id, url) values (auth.uid(), 'https://cal.example/6.ics');
    raise exception '3 FAIL: sixth feed accepted';
  exception when raise_exception then
    if sqlerrm not like 'calendar_feed_limit_exceeded%' then raise; end if;
    raise notice '3 OK: sixth feed rejected';
  end;
  delete from public.user_calendar_feeds where url <> 'https://cal.example/a.ics';
end $$;

-- 4 — An unsatisfiable window (04:00–12:00 + 481 min) is rejected.
do $$
begin
  insert into public.user_calendar_settings (user_id, core_start, core_end, min_free_minutes)
  values (auth.uid(), '04:00', '12:00', 481);
  raise exception '4 FAIL: unsatisfiable window accepted';
exception when check_violation then
  raise notice '4 OK: unsatisfiable window rejected';
end $$;
insert into public.user_calendar_settings (user_id) values (:'owner');

-- 5 — authenticated cannot call the service-role sync RPC.
do $$
begin
  perform public.apply_calendar_availability(auth.uid(), '2030-01-01', '2030-01-10', '{}');
  raise exception '5 FAIL: authenticated called apply_calendar_availability';
exception when insufficient_privilege then
  raise notice '5 OK: sync RPC is service-role only';
end $$;
reset role;

-- 6 — Sync never touches manual rows (tombstone 02, manual 04), and removes stale calendar rows.
do $$
declare r record;
begin
  perform public.apply_calendar_availability(
    '11111111-1111-1111-1111-111111111111', '2030-01-01', '2030-01-10',
    '{2030-01-02,2030-01-03,2030-01-04,2030-03-01}');
  select string_agg(date || ':' || available || ':' || source, ',' order by date) as s into r
  from public.user_availability
  where user_id = '11111111-1111-1111-1111-111111111111' and date >= '2030-01-01';
  if r.s <> '2030-01-02:false:manual,2030-01-03:true:calendar,2030-01-04:true:manual' then
    raise exception '6 FAIL: after seed sync got %', r.s;
  end if;

  -- Rogue call spanning manual days with an empty set: only the calendar row goes.
  perform public.apply_calendar_availability(
    '11111111-1111-1111-1111-111111111111', '2030-01-01', '2030-01-10', '{}');
  select string_agg(date || ':' || available || ':' || source, ',' order by date) as s into r
  from public.user_availability
  where user_id = '11111111-1111-1111-1111-111111111111' and date >= '2030-01-01';
  if r.s <> '2030-01-02:false:manual,2030-01-04:true:manual' then
    raise exception '6 FAIL: after empty sync got %', r.s;
  end if;
  raise notice '6 OK: manual rows survive, out-of-horizon day not written';
end $$;

-- 7 — A friend cannot select the owner's tombstone directly.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'friend', 'role', 'authenticated')::text, true);
do $$
begin
  if not exists (select 1 from public.user_availability
                 where user_id = '11111111-1111-1111-1111-111111111111' and date = '2030-01-04') then
    raise exception '7 FAIL: friend cannot see manual available day (policy too tight)';
  end if;
  if exists (select 1 from public.user_availability
             where user_id = '11111111-1111-1111-1111-111111111111' and not available) then
    raise exception '7 FAIL: friend can read a tombstone';
  end if;
  raise notice '7 OK: tombstone hidden from friend';
end $$;

-- 8 — A non-owner cannot read either new table.
select set_config('request.jwt.claims', json_build_object('sub', :'stranger', 'role', 'authenticated')::text, true);
do $$
begin
  if exists (select 1 from public.user_calendar_feeds where user_id = '11111111-1111-1111-1111-111111111111')
     or exists (select 1 from public.user_calendar_settings where user_id = '11111111-1111-1111-1111-111111111111') then
    raise exception '8 FAIL: stranger can read feeds/settings';
  end if;
  raise notice '8 OK: feeds/settings owner-only';
end $$;
reset role;

-- 9 — Deleting the last feed leaves exactly the manual available days.
do $$
declare r record;
begin
  perform public.apply_calendar_availability(
    '11111111-1111-1111-1111-111111111111', '2030-01-01', '2030-01-10', '{2030-01-05}');
  delete from public.user_calendar_feeds where user_id = '11111111-1111-1111-1111-111111111111';
  select string_agg(date || ':' || available || ':' || source, ',' order by date) as s into r
  from public.user_availability
  where user_id = '11111111-1111-1111-1111-111111111111' and date >= '2030-01-01';
  if r.s <> '2030-01-04:true:manual' then
    raise exception '9 FAIL: after last-feed delete got %', r.s;
  end if;
  raise notice '9 OK: last feed removal returns to manual-only';
end $$;

rollback;
