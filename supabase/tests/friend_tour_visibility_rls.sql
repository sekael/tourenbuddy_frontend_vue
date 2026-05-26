-- RLS verification for friend tour visibility (change: friend-tour-visibility).
--
-- Exercises the two-layer authz against seed data by impersonating users through
-- the `authenticated` role + a request.jwt.claims sub (the same mechanism PostgREST
-- uses, so auth.uid() resolves). Wrapped in a transaction and rolled back, so the
-- local seed is left untouched.
--
-- Run against the local stack:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/friend_tour_visibility_rls.sql
-- A failing assertion RAISEs and aborts with a non-zero exit code.

\set ON_ERROR_STOP on

begin;

-- Seed identities (see supabase/seed.sql)
--   Patrick 1111 (owner), Jakob 2222 (friend + partner on tour ...02),
--   Reni 3333 (pending only, NOT a friend), Selim 4444 (friend, non-partner).
--   Tour ...01 Büelehora: no partners.  Tour ...02 Gfroren Hora: partner = Jakob.

-- Impersonate a user: switch to the authenticated role and set the JWT sub.
-- reset role (back to superuser) between scenarios for setup/teardown mutations.

-- 4.1 — Non-friend (Reni, pending only) gets zero rows from the friend view.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333', 'role', 'authenticated')::text, true);
do $$
begin
  if (select count(*) from public.friend_tours_view) <> 0 then
    raise exception '4.1 FAIL: non-friend Reni sees % friend tours, expected 0',
      (select count(*) from public.friend_tours_view);
  end if;
  raise notice '4.1 OK: non-friend sees zero friend tours';
end $$;
reset role;

-- 4.3a — Friend (Jakob) sees both of Patrick's friends-visible tours.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text, true);
do $$
begin
  if (select count(*) from public.friend_tours_view) <> 2 then
    raise exception '4.3a FAIL: friend Jakob sees % tours, expected 2',
      (select count(*) from public.friend_tours_view);
  end if;
  raise notice '4.3a OK: friend sees both friends-visible tours';
end $$;

-- 4.3b — Partner friend (Jakob on tour ...02) gets full detail (planned_date present).
do $$
declare r record;
begin
  select is_partner, planned_date into r
  from public.friend_tours_view where id = 'cccccccc-0000-0000-0000-000000000002';
  if not r.is_partner then
    raise exception '4.3b FAIL: Jakob should be a partner on tour ...02';
  end if;
  if r.planned_date is null then
    raise exception '4.3b FAIL: partner friend must see planned_date';
  end if;
  raise notice '4.3b OK: partner friend sees ungated detail';
end $$;

-- 4.3c — Non-partner friend (Jakob on tour ...01) gets gated columns.
do $$
declare r record;
begin
  select is_partner, planned_date into r
  from public.friend_tours_view where id = 'cccccccc-0000-0000-0000-000000000001';
  if r.is_partner then
    raise exception '4.3c FAIL: Jakob is not a partner on tour ...01';
  end if;
  if r.planned_date is not null then
    raise exception '4.3c FAIL: non-partner friend must have planned_date gated to null';
  end if;
  raise notice '4.3c OK: non-partner friend sees gated columns';
end $$;
reset role;

-- 4.2 — Private tour is invisible even to a marked partner friend.
update public.tours set visibility = 'private' where id = 'cccccccc-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text, true);
do $$
begin
  if exists (select 1 from public.friend_tours_view where id = 'cccccccc-0000-0000-0000-000000000002') then
    raise exception '4.2 FAIL: private tour visible to partner friend';
  end if;
  if (select count(*) from public.friend_tours_view) <> 1 then
    raise exception '4.2 FAIL: Jakob should still see the other (friends) tour';
  end if;
  raise notice '4.2 OK: private tour hidden from partner friend';
end $$;
reset role;

-- 4.4 — Removing the friendship revokes all read access.
delete from public.friendships
where (request_user_id = '11111111-1111-1111-1111-111111111111'
       and response_user_id = '22222222-2222-2222-2222-222222222222');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text, true);
do $$
begin
  if (select count(*) from public.friend_tours_view) <> 0 then
    raise exception '4.4 FAIL: ex-friend still sees % tours', (select count(*) from public.friend_tours_view);
  end if;
  raise notice '4.4 OK: removing friendship revokes access';
end $$;
reset role;

rollback;
