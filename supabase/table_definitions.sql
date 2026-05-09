-- Tours
create table public.tours (
  id uuid not null default gen_random_uuid (),
  planned_date date null,
  user_id uuid not null default auth.uid (),
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
  constraint tours_user_id_fkey foreign KEY (user_id) references user_profile (id) on update CASCADE on delete CASCADE,
  constraint tours_name_check check ((length(name) < 100)),
  constraint tours_tour_type_check check (
    (
      (tour_type is null)
      or (
        tour_type = any (
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
    )
  )
) TABLESPACE pg_default;

create view public.tours_view as
select
  id,
  user_id,
  planned_date,
  name,
  st_x (goal::geometry) as lon,
  st_y (goal::geometry) as lat,
  tour_type,
  elevation,
  gpx_filepath,
  description,
  seasons,
  st_x (start_point::geometry) as start_lon,
  st_y (start_point::geometry) as start_lat,
  st_x (end_point::geometry) as end_lon,
  st_y (end_point::geometry) as end_lat,
  start_point_name,
  start_point_elevation,
  end_point_name,
  end_point_elevation,
  equipment,
  notes,
  completed,
  (
    select
      COALESCE(json_agg(tp.contact_id), '[]'::json) as "coalesce"
    from
      tour_partners tp
    where
      tp.tour_id = t.id
  ) as partner_ids
from
  tours t;

-- Contacts
create table public.contacts (
  id uuid not null default gen_random_uuid (),
  first_name text not null,
  last_name text null,
  display_name text null,
  user_id uuid not null default auth.uid (),
  constraint contacts_pkey primary key (id),
  constraint contacts_user_id_fkey foreign KEY (user_id) references user_profile (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create table public.contact_methods (
  id uuid not null default gen_random_uuid (),
  contact_id uuid not null,
  method_type public.contact_method_type not null,
  value text not null,
  label text null,
  is_primary boolean not null default false,
  constraint contact_methods_pkey primary key (id),
  constraint contact_methods_unique_per_contact unique (contact_id, method_type, value),
  constraint contact_methods_contact_id_fkey foreign KEY (contact_id) references contacts (id) on delete CASCADE
) TABLESPACE pg_default;

create unique INDEX IF not exists contact_methods_one_primary_phone on public.contact_methods using btree (contact_id) TABLESPACE pg_default
where
  (
    (method_type = 'phone'::contact_method_type)
    and is_primary
  );

create unique INDEX IF not exists contact_methods_one_primary_email on public.contact_methods using btree (contact_id) TABLESPACE pg_default
where
  (
    (method_type = 'email'::contact_method_type)
    and is_primary
  );

-- Touring Partners
create table public.tour_partners (
  tour_id uuid not null,
  contact_id uuid not null,
  constraint tour_partners_pkey primary key (tour_id, contact_id),
  constraint tour_partners_contact_id_fkey foreign KEY (contact_id) references contacts (id) on delete CASCADE,
  constraint tour_partners_tour_id_fkey foreign KEY (tour_id) references tours (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists tour_partners_contact_id_idx on public.tour_partners using btree (contact_id) TABLESPACE pg_default;

-- User Profile
create table public.user_profile (
  id uuid not null,
  first_name text null,
  last_name text null,
  locale text null,
  notif_push_enabled boolean not null default true,
  notif_email_enabled boolean not null default true,
  notif_muted_types text[] not null default '{}'::text[],
  constraint user_profile_pkey primary key (id),
  constraint user_profile_id_fk foreign KEY (id) references auth.users (id) on update CASCADE on delete CASCADE,
  constraint user_profile_locale_check check (
    (
      (locale is null)
      or (locale = any (array['en'::text, 'de-CH'::text]))
    )
  )
) TABLESPACE pg_default;

-- Friendships
create table public.friend_requests (
  id uuid not null default gen_random_uuid (),
  from_user_id uuid not null default auth.uid (),
  to_user_id uuid not null,
  status text not null default 'pending'::text,
  created_at timestamp with time zone not null default now(),
  responded_at timestamp with time zone null,
  constraint friend_requests_pkey primary key (id),
  constraint friend_requests_from_user_id_fkey foreign KEY (from_user_id) references auth.users (id) on delete CASCADE,
  constraint friend_requests_to_user_id_fkey foreign KEY (to_user_id) references auth.users (id) on delete CASCADE,
  constraint friend_requests_check check ((from_user_id <> to_user_id)),
  constraint friend_requests_status_check check (
    (
      status = any (
        array[
          'pending'::text,
          'accepted'::text,
          'denied'::text,
          'cancelled'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create unique INDEX IF not exists friend_requests_pending_pair_idx on public.friend_requests using btree (from_user_id, to_user_id) TABLESPACE pg_default
where
  (status = 'pending'::text);

create table public.friendships (
  request_user_id uuid not null,
  response_user_id uuid not null,
  created_at timestamp with time zone not null default now(),
  request_id uuid null,
  constraint friendships_pkey primary key (request_user_id, response_user_id),
  constraint friendships_request_id_fkey foreign KEY (request_id) references friend_requests (id) on delete set null,
  constraint friendships_user_a_id_fkey foreign KEY (request_user_id) references auth.users (id) on delete CASCADE,
  constraint friendships_user_b_id_fkey foreign KEY (response_user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create unique INDEX IF not exists friendships_unordered_pair_idx on public.friendships using btree (
  LEAST(request_user_id, response_user_id),
  GREATEST(request_user_id, response_user_id)
) TABLESPACE pg_default;

-- Push notifications
create table public.push_subscriptions (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text null,
  created_at timestamp with time zone not null default now(),
  last_seen_at timestamp with time zone not null default now(),
  constraint push_subscriptions_pkey primary key (id),
  constraint push_subscriptions_endpoint_key unique (endpoint),
  constraint push_subscriptions_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists push_subscriptions_user_id_idx on public.push_subscriptions using btree (user_id) TABLESPACE pg_default;




