-- =============================================================================
-- Local-only test data seed
-- -----------------------------------------------------------------------------
-- Runs automatically on `supabase db reset` (configured via [db.seed] in
-- config.toml). NEVER pushed to production by `supabase db push`.
--
-- Three test users with verified phone numbers so friendship features work:
--   Patrick (patrick@tourenbuddy.ch / +41790000001) — friends with Jakob
--   Jakob   (jakob@tourenbuddy.ch   / +41790000002) — friends with Patrick
--   Reni    (reni@tourenbuddy.ch    / +41790000003) — pending friend req → Patrick
--
-- Login locally via OTP code "123456" (see [auth.sms.test_otp] and
-- [auth.email.test_otp] in supabase/config.toml).
--
-- All inserts idempotent so re-running this file is safe.
-- =============================================================================

-- ----- auth.users -----------------------------------------------------------
-- phone column stored without leading '+', matching find_user_by_phone() expectations.
INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password, email_confirmed_at,
  phone, phone_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
  ('11111111-1111-1111-1111-111111111111',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated',
   'patrick@tourenbuddy.ch',
   crypt('test-password-123', gen_salt('bf')),
   now(),
   '41790000001', now(),
   '{"provider":"email","providers":["email","phone"]}'::jsonb,
   '{"first_name":"Patrick","last_name":"Tester"}'::jsonb,
   now(), now(), '', '', '', ''),
  ('22222222-2222-2222-2222-222222222222',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated',
   'jakob@tourenbuddy.ch',
   crypt('test-password-123', gen_salt('bf')),
   now(),
   '41790000002', now(),
   '{"provider":"email","providers":["email","phone"]}'::jsonb,
   '{"first_name":"Jakob","last_name":"Tester"}'::jsonb,
   now(), now(), '', '', '', ''),
  ('33333333-3333-3333-3333-333333333333',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated',
   'reni@tourenbuddy.ch',
   crypt('test-password-123', gen_salt('bf')),
   now(),
   '41790000003', now(),
   '{"provider":"email","providers":["email","phone"]}'::jsonb,
   '{"first_name":"Reni","last_name":"Tester"}'::jsonb,
   now(), now(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- ----- auth.identities ------------------------------------------------------
-- Required for email-based login alongside the auth.users row.
INSERT INTO auth.identities (
  provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) VALUES
  ('11111111-1111-1111-1111-111111111111',
   '11111111-1111-1111-1111-111111111111',
   jsonb_build_object('sub','11111111-1111-1111-1111-111111111111','email','patrick@tourenbuddy.ch','email_verified',true,'phone_verified',true),
   'email', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222',
   '22222222-2222-2222-2222-222222222222',
   jsonb_build_object('sub','22222222-2222-2222-2222-222222222222','email','jakob@tourenbuddy.ch','email_verified',true,'phone_verified',true),
   'email', now(), now(), now()),
  ('33333333-3333-3333-3333-333333333333',
   '33333333-3333-3333-3333-333333333333',
   jsonb_build_object('sub','33333333-3333-3333-3333-333333333333','email','reni@tourenbuddy.ch','email_verified',true,'phone_verified',true),
   'email', now(), now(), now())
ON CONFLICT (provider, provider_id) DO NOTHING;

-- ----- public.user_profile --------------------------------------------------
INSERT INTO public.user_profile (id, first_name, last_name, locale)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Patrick', 'Tester', 'de-CH'),
  ('22222222-2222-2222-2222-222222222222', 'Jakob',   'Tester', 'de-CH'),
  ('33333333-3333-3333-3333-333333333333', 'Reni',    'Tester', 'de-CH')
ON CONFLICT (id) DO NOTHING;

-- ----- public.contacts ------------------------------------------------------
-- Each user has the other as a contact so tour_partners linking works.
INSERT INTO public.contacts (id, first_name, last_name, display_name, user_id) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Jakob',   'Tester', 'Jakob Tester',
   '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Patrick', 'Tester', 'Patrick Tester',
   '22222222-2222-2222-2222-222222222222')
ON CONFLICT (id) DO NOTHING;

-- ----- public.contact_methods (phones with leading '+') ---------------------
INSERT INTO public.contact_methods (contact_id, method_type, value, is_primary) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'phone', '+41790000002', true),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'phone', '+41790000001', true)
ON CONFLICT (contact_id, method_type, value) DO NOTHING;

-- ----- public.friendships (Patrick ↔ Jakob) --------------------------------
INSERT INTO public.friendships (request_user_id, response_user_id, created_at)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  now()
)
ON CONFLICT DO NOTHING;

-- ----- public.friend_requests (Reni → Patrick, pending) --------------------
INSERT INTO public.friend_requests (id, from_user_id, to_user_id, status, created_at)
VALUES (
  'bbbbbbbb-0000-0000-0000-000000000001',
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'pending', now()
)
ON CONFLICT (id) DO NOTHING;

-- ----- public.tours ---------------------------------------------------------
-- Solo tour for Patrick.
INSERT INTO public.tours (
  id, planned_date, user_id, goal, name, tour_type, start_point_name
) VALUES (
  'cccccccc-0000-0000-0000-000000000001',
  current_date + 7,
  '11111111-1111-1111-1111-111111111111',
  ST_GeogFromText('SRID=4326;POINT(7.6566 46.5547)'),
  'Eigertrail Solo',
  'hiking',
  'Grindelwald'
)
ON CONFLICT (id) DO NOTHING;

-- Joint tour: owned by Patrick, partner = Jakob (via Patrick's contact for Jakob).
INSERT INTO public.tours (
  id, planned_date, user_id, goal, name, tour_type, start_point_name
) VALUES (
  'cccccccc-0000-0000-0000-000000000002',
  current_date + 14,
  '11111111-1111-1111-1111-111111111111',
  ST_GeogFromText('SRID=4326;POINT(8.0234 46.7654)'),
  'Skitour Wildhorn',
  'skitour',
  'Lauenen'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tour_partners (tour_id, contact_id) VALUES
  ('cccccccc-0000-0000-0000-000000000002',
   'aaaaaaaa-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;
