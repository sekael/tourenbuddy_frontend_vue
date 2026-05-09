-- Baseline schema (dev): consolidated from current production definitions plus
-- RPCs, RLS, and storage policies required by the Vue app.

create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

create type public.contact_method_type as enum ('phone', 'email');

-- ---------------------------------------------------------------------------
-- Core tables (FK order)
-- ---------------------------------------------------------------------------

create table public.user_profile (
  id uuid not null,
  first_name text null,
  last_name text null,
  locale text null,
  notif_push_enabled boolean not null default true,
  notif_email_enabled boolean not null default true,
  notif_muted_types text[] not null default '{}'::text[],
  constraint user_profile_pkey primary key (id),
  constraint user_profile_id_fk foreign key (id) references auth.users (id) on update cascade on delete cascade,
  constraint user_profile_locale_check check (
    locale is null
    or locale = any (array['en'::text, 'de-CH'::text])
  )
);

create table public.contacts (
  id uuid not null default gen_random_uuid(),
  first_name text not null,
  last_name text null,
  display_name text null,
  user_id uuid not null default auth.uid(),
  constraint contacts_pkey primary key (id),
  constraint contacts_user_id_fkey foreign key (user_id) references public.user_profile (id) on update cascade on delete cascade
);

create table public.contact_methods (
  id uuid not null default gen_random_uuid(),
  contact_id uuid not null,
  method_type public.contact_method_type not null,
  value text not null,
  label text null,
  is_primary boolean not null default false,
  is_valid boolean not null default true,
  constraint contact_methods_pkey primary key (id),
  constraint contact_methods_unique_per_contact unique (contact_id, method_type, value),
  constraint contact_methods_contact_id_fkey foreign key (contact_id) references public.contacts (id) on delete cascade
);

create unique index if not exists contact_methods_one_primary_phone
  on public.contact_methods (contact_id)
  where method_type = 'phone'::public.contact_method_type
    and is_primary;

create unique index if not exists contact_methods_one_primary_email
  on public.contact_methods (contact_id)
  where method_type = 'email'::public.contact_method_type
    and is_primary;

create table public.tours (
  id uuid not null default gen_random_uuid(),
  planned_date date null,
  user_id uuid not null default auth.uid(),
  goal geography not null,
  name text null,
  tour_type text null,
  elevation numeric null,
  description text null,
  seasons text[] null,
  start_point geography null,
  end_point geography null,
  equipment text null,
  notes text null,
  completed boolean not null default false,
  start_point_name text null,
  start_point_elevation integer null,
  end_point_name text null,
  end_point_elevation integer null,
  gpx_filepath text null,
  constraint tours_pkey primary key (id),
  constraint tours_user_id_fkey foreign key (user_id) references public.user_profile (id) on update cascade on delete cascade,
  constraint tours_name_check check (length(name) < 100),
  constraint tours_tour_type_check check (
    tour_type is null
    or tour_type = any (
      array[
        'skiing'::text,
        'snowboarding'::text,
        'skitour'::text,
        'splitboarding'::text,
        'ski-mountaineering'::text,
        'paragliding'::text,
        'hiking'::text,
        'mountaineering'::text,
        'climbing'::text,
        'mountain-biking'::text,
        'trailrunning'::text
      ]
    )
  )
);

create table public.tour_partners (
  tour_id uuid not null,
  contact_id uuid not null,
  constraint tour_partners_pkey primary key (tour_id, contact_id),
  constraint tour_partners_contact_id_fkey foreign key (contact_id) references public.contacts (id) on delete cascade,
  constraint tour_partners_tour_id_fkey foreign key (tour_id) references public.tours (id) on delete cascade
);

create index if not exists tour_partners_contact_id_idx on public.tour_partners (contact_id);

create view public.tours_view as
select
  t.id,
  t.user_id,
  t.planned_date,
  t.name,
  st_x(t.goal::geometry) as lon,
  st_y(t.goal::geometry) as lat,
  t.tour_type,
  t.elevation,
  t.gpx_filepath,
  t.description,
  t.seasons,
  st_x(t.start_point::geometry) as start_lon,
  st_y(t.start_point::geometry) as start_lat,
  st_x(t.end_point::geometry) as end_lon,
  st_y(t.end_point::geometry) as end_lat,
  t.start_point_name,
  t.start_point_elevation,
  t.end_point_name,
  t.end_point_elevation,
  t.equipment,
  t.notes,
  t.completed,
  (
    select coalesce(json_agg(tp.contact_id), '[]'::json)
    from public.tour_partners tp
    where tp.tour_id = t.id
  ) as partner_ids
from public.tours t;

create table public.friend_requests (
  id uuid not null default gen_random_uuid(),
  from_user_id uuid not null default auth.uid(),
  to_user_id uuid not null,
  status text not null default 'pending'::text,
  created_at timestamptz not null default now(),
  responded_at timestamptz null,
  constraint friend_requests_pkey primary key (id),
  constraint friend_requests_from_user_id_fkey foreign key (from_user_id) references auth.users (id) on delete cascade,
  constraint friend_requests_to_user_id_fkey foreign key (to_user_id) references auth.users (id) on delete cascade,
  constraint friend_requests_check check (from_user_id <> to_user_id),
  constraint friend_requests_status_check check (
    status = any (
      array[
        'pending'::text,
        'accepted'::text,
        'denied'::text,
        'cancelled'::text
      ]
    )
  )
);

create unique index if not exists friend_requests_pending_pair_idx
  on public.friend_requests (from_user_id, to_user_id)
  where status = 'pending'::text;

create table public.friendships (
  request_user_id uuid not null,
  response_user_id uuid not null,
  created_at timestamptz not null default now(),
  request_id uuid null,
  constraint friendships_pkey primary key (request_user_id, response_user_id),
  constraint friendships_request_id_fkey foreign key (request_id) references public.friend_requests (id) on delete set null,
  constraint friendships_user_a_id_fkey foreign key (request_user_id) references auth.users (id) on delete cascade,
  constraint friendships_user_b_id_fkey foreign key (response_user_id) references auth.users (id) on delete cascade
);

create unique index if not exists friendships_unordered_pair_idx
  on public.friendships (
    least(request_user_id, response_user_id),
    greatest(request_user_id, response_user_id)
  );

create table public.push_subscriptions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint push_subscriptions_pkey primary key (id),
  constraint push_subscriptions_endpoint_key unique (endpoint),
  constraint push_subscriptions_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- RLS: friend graph (policies reference is_phone_verified)
-- ---------------------------------------------------------------------------

create or replace function public.is_phone_verified(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users
    where id = p_user_id and phone_confirmed_at is not null
  );
$$;

alter table public.friend_requests enable row level security;

create policy "friend_requests_select"
  on public.friend_requests for select
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create policy "friend_requests_insert"
  on public.friend_requests for insert
  with check (
    auth.uid() = from_user_id
    and public.is_phone_verified(auth.uid())
    and public.is_phone_verified(to_user_id)
  );

create policy "friend_requests_update_recipient"
  on public.friend_requests for update
  using (auth.uid() = to_user_id and status = 'pending')
  with check (status in ('accepted', 'denied'));

create policy "friend_requests_update_sender"
  on public.friend_requests for update
  using (auth.uid() = from_user_id and status = 'pending')
  with check (status = 'cancelled');

alter table public.friendships enable row level security;

create policy "friendships_select"
  on public.friendships for select
  using (auth.uid() = request_user_id or auth.uid() = response_user_id);

-- ---------------------------------------------------------------------------
-- RPCs: tours
-- ---------------------------------------------------------------------------

create or replace function public.create_tour_full(
  p_id uuid,
  p_planned_date date default null,
  p_name text default null,
  p_goal text default null,
  p_partner_ids uuid[] default '{}',
  p_tour_type text default null,
  p_elevation numeric default null,
  p_gpx_filepath text default null,
  p_description text default null,
  p_seasons text[] default null,
  p_start_point text default null,
  p_end_point text default null,
  p_equipment text default null,
  p_notes text default null,
  p_start_point_name text default null,
  p_start_point_elevation integer default null,
  p_end_point_name text default null,
  p_end_point_elevation integer default null
)
returns void
language plpgsql
security definer
set search_path to public, extensions
as $$
begin
  insert into public.tours (
    id,
    planned_date,
    name,
    goal,
    user_id,
    tour_type,
    elevation,
    gpx_filepath,
    description,
    seasons,
    start_point,
    end_point,
    equipment,
    notes,
    start_point_name,
    start_point_elevation,
    end_point_name,
    end_point_elevation
  ) values (
    p_id,
    p_planned_date,
    p_name,
    p_goal::geography,
    auth.uid(),
    p_tour_type,
    p_elevation,
    p_gpx_filepath,
    p_description,
    p_seasons,
    case when p_start_point is not null then p_start_point::geography else null end,
    case when p_end_point is not null then p_end_point::geography else null end,
    p_equipment,
    p_notes,
    p_start_point_name,
    p_start_point_elevation,
    p_end_point_name,
    p_end_point_elevation
  );

  if array_length(p_partner_ids, 1) > 0 then
    insert into public.tour_partners (tour_id, contact_id)
    select p_id, unnest(p_partner_ids);
  end if;
end;
$$;

create or replace function public.update_tour_full(
  p_id uuid,
  p_planned_date date default null,
  p_name text default null,
  p_goal text default null,
  p_partner_ids uuid[] default '{}',
  p_tour_type text default null,
  p_elevation numeric default null,
  p_gpx_filepath text default null,
  p_description text default null,
  p_seasons text[] default null,
  p_start_point text default null,
  p_end_point text default null,
  p_equipment text default null,
  p_notes text default null,
  p_start_point_name text default null,
  p_start_point_elevation integer default null,
  p_end_point_name text default null,
  p_end_point_elevation integer default null
)
returns void
language plpgsql
security definer
set search_path to public, extensions
as $$
begin
  if not exists (
    select 1 from public.tours where id = p_id and user_id = auth.uid()
  ) then
    raise exception 'Tour not found or access denied';
  end if;

  update public.tours set
    planned_date = p_planned_date,
    name = p_name,
    goal = p_goal::geography,
    tour_type = p_tour_type,
    elevation = p_elevation,
    gpx_filepath = p_gpx_filepath,
    description = p_description,
    seasons = p_seasons,
    start_point = case when p_start_point is not null then p_start_point::geography else null end,
    end_point = case when p_end_point is not null then p_end_point::geography else null end,
    equipment = p_equipment,
    notes = p_notes,
    start_point_name = p_start_point_name,
    start_point_elevation = p_start_point_elevation,
    end_point_name = p_end_point_name,
    end_point_elevation = p_end_point_elevation
  where id = p_id;

  delete from public.tour_partners where tour_id = p_id;

  if p_partner_ids is not null and array_length(p_partner_ids, 1) > 0 then
    insert into public.tour_partners (tour_id, contact_id)
    select p_id, unnest(p_partner_ids);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPCs: contacts & friendships
-- ---------------------------------------------------------------------------

create or replace function public.set_primary_phone(p_contact_id uuid, p_method_id uuid)
returns setof public.contact_methods
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.contact_methods
  set is_primary = false
  where contact_id = p_contact_id
    and method_type = 'phone'
    and id <> p_method_id;

  update public.contact_methods
  set is_primary = true
  where id = p_method_id
    and contact_id = p_contact_id
    and method_type = 'phone';

  if not found then
    raise exception 'method % not found for contact % or is not a phone method', p_method_id, p_contact_id;
  end if;

  return query
  select * from public.contact_methods
  where contact_id = p_contact_id
    and method_type = 'phone';
end;
$$;

create or replace function public.find_user_by_phone(p_phone text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_normalized text := ltrim(p_phone, '+');
  v_result uuid;
begin
  if not exists (
    select 1 from auth.users
    where id = v_caller_id and phone_confirmed_at is not null
  ) then
    return null;
  end if;

  select id into v_result
  from auth.users
  where phone = v_normalized
    and phone_confirmed_at is not null
    and id <> v_caller_id
  limit 1;

  return v_result;
end;
$$;

create or replace function public.find_users_by_phones(p_phones text[])
returns table (phone text, user_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_normalized text[];
begin
  if not exists (
    select 1 from auth.users
    where id = v_caller_id and phone_confirmed_at is not null
  ) then
    return;
  end if;

  select array_agg(ltrim(p, '+'))
  into v_normalized
  from unnest(p_phones) as p;

  return query
  select ('+' || u.phone)::text, u.id
  from auth.users u
  where u.phone = any(v_normalized)
    and u.phone_confirmed_at is not null
    and u.id <> v_caller_id;
end;
$$;

create or replace function public.find_phones_by_user_ids(p_user_ids uuid[])
returns table (user_id uuid, phone text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
begin
  if not exists (
    select 1 from auth.users where id = v_caller_id and phone_confirmed_at is not null
  ) then
    return;
  end if;

  return query
  select u.id, ('+' || u.phone)::text
  from auth.users u
  where u.id = any(p_user_ids)
    and u.phone_confirmed_at is not null
    and (
      exists (
        select 1 from public.friend_requests fr
        where fr.status = 'pending'
          and (
            (fr.from_user_id = v_caller_id and fr.to_user_id = u.id)
            or (fr.from_user_id = u.id and fr.to_user_id = v_caller_id)
          )
      )
      or exists (
        select 1 from public.friendships f
        where (f.request_user_id = v_caller_id and f.response_user_id = u.id)
           or (f.request_user_id = u.id and f.response_user_id = v_caller_id)
      )
    );
end;
$$;

create or replace function public.accept_friend_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_from uuid;
  v_to uuid;
  v_status text;
begin
  select from_user_id, to_user_id, status
  into v_from, v_to, v_status
  from public.friend_requests
  where id = p_request_id;

  if not found then
    raise exception 'Friend request not found';
  end if;

  if v_caller_id <> v_to then
    raise exception 'Only the recipient can accept a friend request';
  end if;

  if v_status = 'accepted' then
    return;
  end if;

  if v_status <> 'pending' then
    raise exception 'Friend request is not pending';
  end if;

  update public.friend_requests
  set status = 'accepted', responded_at = now()
  where id = p_request_id;

  insert into public.friendships (request_user_id, response_user_id, request_id)
  values (v_from, v_to, p_request_id)
  on conflict (least(request_user_id, response_user_id), greatest(request_user_id, response_user_id))
  do nothing;
end;
$$;

create or replace function public.remove_friendship(p_other_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
begin
  delete from public.friendships
  where (request_user_id = v_caller_id and response_user_id = p_other_user_id)
     or (request_user_id = p_other_user_id and response_user_id = v_caller_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage: tour-gpx bucket + RLS (paths ${userId}/${tourId}.gpx)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('tour-gpx', 'tour-gpx', false)
on conflict (id) do nothing;

create policy "tour-gpx owner insert"
  on storage.objects
  for insert
  with check (
    bucket_id = 'tour-gpx'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "tour-gpx owner update"
  on storage.objects
  for update
  using (
    bucket_id = 'tour-gpx'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "tour-gpx owner delete"
  on storage.objects
  for delete
  using (
    bucket_id = 'tour-gpx'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "tour-gpx owner select"
  on storage.objects
  for select
  using (
    bucket_id = 'tour-gpx'
    and exists (
      select 1 from public.tours t
      where t.id::text = split_part(split_part(name, '/', 2), '.gpx', 1)
        and t.user_id = auth.uid()
    )
  );
