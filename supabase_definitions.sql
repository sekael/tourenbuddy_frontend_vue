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
