SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE SCHEMA IF NOT EXISTS "storage";


ALTER SCHEMA "storage" OWNER TO "supabase_admin";


CREATE TYPE "public"."contact_method_type" AS ENUM (
    'phone',
    'email'
);


ALTER TYPE "public"."contact_method_type" OWNER TO "postgres";


CREATE TYPE "storage"."buckettype" AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


ALTER TYPE "storage"."buckettype" OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "public"."accept_friend_request"("p_request_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
    return; -- idempotent
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


ALTER FUNCTION "public"."accept_friend_request"("p_request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_tour_full"("p_id" "uuid", "p_planned_date" "date" DEFAULT NULL::"date", "p_name" "text" DEFAULT NULL::"text", "p_goal" "text" DEFAULT NULL::"text", "p_partner_ids" "uuid"[] DEFAULT '{}'::"uuid"[], "p_tour_type" "text" DEFAULT NULL::"text", "p_elevation" numeric DEFAULT NULL::numeric, "p_gpx_filepath" "text" DEFAULT NULL::"text", "p_description" "text" DEFAULT NULL::"text", "p_seasons" "text"[] DEFAULT NULL::"text"[], "p_start_point" "text" DEFAULT NULL::"text", "p_end_point" "text" DEFAULT NULL::"text", "p_equipment" "text" DEFAULT NULL::"text", "p_notes" "text" DEFAULT NULL::"text", "p_start_point_name" "text" DEFAULT NULL::"text", "p_start_point_elevation" integer DEFAULT NULL::integer, "p_end_point_name" "text" DEFAULT NULL::"text", "p_end_point_elevation" integer DEFAULT NULL::integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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


ALTER FUNCTION "public"."create_tour_full"("p_id" "uuid", "p_planned_date" "date", "p_name" "text", "p_goal" "text", "p_partner_ids" "uuid"[], "p_tour_type" "text", "p_elevation" numeric, "p_gpx_filepath" "text", "p_description" "text", "p_seasons" "text"[], "p_start_point" "text", "p_end_point" "text", "p_equipment" "text", "p_notes" "text", "p_start_point_name" "text", "p_start_point_elevation" integer, "p_end_point_name" "text", "p_end_point_elevation" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_phones_by_user_ids"("p_user_ids" "uuid"[]) RETURNS TABLE("user_id" "uuid", "phone" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."find_phones_by_user_ids"("p_user_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_user_by_phone"("p_phone" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."find_user_by_phone"("p_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_users_by_phones"("p_phones" "text"[]) RETURNS TABLE("phone" "text", "user_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

  -- Strip leading '+' from each input phone before comparing
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


ALTER FUNCTION "public"."find_users_by_phones"("p_phones" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_phone_verified"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1 from auth.users
    where id = p_user_id and phone_confirmed_at is not null
  );
$$;


ALTER FUNCTION "public"."is_phone_verified"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_friendship"("p_other_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_caller_id uuid := auth.uid();
begin
  delete from public.friendships
  where (request_user_id = v_caller_id and response_user_id = p_other_user_id)
     or (request_user_id = p_other_user_id and response_user_id = v_caller_id);
end;
$$;


ALTER FUNCTION "public"."remove_friendship"("p_other_user_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."contact_methods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "method_type" "public"."contact_method_type" NOT NULL,
    "value" "text" NOT NULL,
    "label" "text",
    "is_primary" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."contact_methods" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_primary_phone"("p_contact_id" "uuid", "p_method_id" "uuid") RETURNS SETOF "public"."contact_methods"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE contact_methods
    SET is_primary = false
  WHERE contact_id = p_contact_id
    AND method_type = 'phone'
    AND id <> p_method_id;

  UPDATE contact_methods
    SET is_primary = true
  WHERE id = p_method_id
    AND contact_id = p_contact_id
    AND method_type = 'phone';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'method % not found for contact % or is not a phone method', p_method_id, p_contact_id;
  END IF;

  RETURN QUERY
    SELECT * FROM contact_methods
    WHERE contact_id = p_contact_id
      AND method_type = 'phone';
END;
$$;


ALTER FUNCTION "public"."set_primary_phone"("p_contact_id" "uuid", "p_method_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_tour_full"("p_id" "uuid", "p_planned_date" "date" DEFAULT NULL::"date", "p_name" "text" DEFAULT NULL::"text", "p_goal" "text" DEFAULT NULL::"text", "p_partner_ids" "uuid"[] DEFAULT '{}'::"uuid"[], "p_tour_type" "text" DEFAULT NULL::"text", "p_elevation" numeric DEFAULT NULL::numeric, "p_gpx_filepath" "text" DEFAULT NULL::"text", "p_description" "text" DEFAULT NULL::"text", "p_seasons" "text"[] DEFAULT NULL::"text"[], "p_start_point" "text" DEFAULT NULL::"text", "p_end_point" "text" DEFAULT NULL::"text", "p_equipment" "text" DEFAULT NULL::"text", "p_notes" "text" DEFAULT NULL::"text", "p_start_point_name" "text" DEFAULT NULL::"text", "p_start_point_elevation" integer DEFAULT NULL::integer, "p_end_point_name" "text" DEFAULT NULL::"text", "p_end_point_elevation" integer DEFAULT NULL::integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if not exists (
    select 1 from public.tours where id = p_id and user_id = auth.uid()
  ) then
    raise exception 'Tour not found or access denied';
  end if;

  update public.tours set
    planned_date          = p_planned_date,
    name                  = p_name,
    goal                  = p_goal::geography,
    tour_type             = p_tour_type,
    elevation             = p_elevation,
    gpx_filepath          = p_gpx_filepath,
    description           = p_description,
    seasons               = p_seasons,
    start_point           = case when p_start_point is not null then p_start_point::geography else null end,
    end_point             = case when p_end_point   is not null then p_end_point::geography   else null end,
    equipment             = p_equipment,
    notes                 = p_notes,
    start_point_name      = p_start_point_name,
    start_point_elevation = p_start_point_elevation,
    end_point_name        = p_end_point_name,
    end_point_elevation   = p_end_point_elevation
  where id = p_id;

  delete from public.tour_partners where tour_id = p_id;

  if p_partner_ids is not null and array_length(p_partner_ids, 1) > 0 then
    insert into public.tour_partners (tour_id, contact_id)
    select p_id, unnest(p_partner_ids);
  end if;
end;
$$;


ALTER FUNCTION "public"."update_tour_full"("p_id" "uuid", "p_planned_date" "date", "p_name" "text", "p_goal" "text", "p_partner_ids" "uuid"[], "p_tour_type" "text", "p_elevation" numeric, "p_gpx_filepath" "text", "p_description" "text", "p_seasons" "text"[], "p_start_point" "text", "p_end_point" "text", "p_equipment" "text", "p_notes" "text", "p_start_point_name" "text", "p_start_point_elevation" integer, "p_end_point_name" "text", "p_end_point_elevation" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "storage"."allow_any_operation"("expected_operations" "text"[]) RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT CASE
      WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
      ELSE raw_operation
    END AS current_operation
    FROM current_operation
  )
  SELECT EXISTS (
    SELECT 1
    FROM normalized n
    CROSS JOIN LATERAL unnest(expected_operations) AS expected_operation
    WHERE expected_operation IS NOT NULL
      AND expected_operation <> ''
      AND n.current_operation = CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END
  );
$$;


ALTER FUNCTION "storage"."allow_any_operation"("expected_operations" "text"[]) OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."allow_only_operation"("expected_operation" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT
      CASE
        WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
        ELSE raw_operation
      END AS current_operation,
      CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END AS requested_operation
    FROM current_operation
  )
  SELECT CASE
    WHEN requested_operation IS NULL OR requested_operation = '' THEN FALSE
    ELSE COALESCE(current_operation = requested_operation, FALSE)
  END
  FROM normalized;
$$;


ALTER FUNCTION "storage"."allow_only_operation"("expected_operation" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."can_insert_object"("bucketid" "text", "name" "text", "owner" "uuid", "metadata" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


ALTER FUNCTION "storage"."can_insert_object"("bucketid" "text", "name" "text", "owner" "uuid", "metadata" "jsonb") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."enforce_bucket_name_length"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


ALTER FUNCTION "storage"."enforce_bucket_name_length"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."extension"("name" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Get the last path segment (the actual filename)
    SELECT _parts[array_length(_parts, 1)] INTO _filename;
    -- Extract extension: reverse, split on '.', then reverse again
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


ALTER FUNCTION "storage"."extension"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."filename"("name" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


ALTER FUNCTION "storage"."filename"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."foldername"("name" "text") RETURNS "text"[]
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


ALTER FUNCTION "storage"."foldername"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_common_prefix"("p_key" "text", "p_prefix" "text", "p_delimiter" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
SELECT CASE
    WHEN position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(p_key, length(p_prefix) + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)))
    ELSE NULL
END;
$$;


ALTER FUNCTION "storage"."get_common_prefix"("p_key" "text", "p_prefix" "text", "p_delimiter" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_size_by_bucket"() RETURNS TABLE("size" bigint, "bucket_id" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint)::bigint as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


ALTER FUNCTION "storage"."get_size_by_bucket"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."list_multipart_uploads_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer DEFAULT 100, "next_key_token" "text" DEFAULT ''::"text", "next_upload_token" "text" DEFAULT ''::"text") RETURNS TABLE("key" "text", "id" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


ALTER FUNCTION "storage"."list_multipart_uploads_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer, "next_key_token" "text", "next_upload_token" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."list_objects_with_delimiter"("_bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer DEFAULT 100, "start_after" "text" DEFAULT ''::"text", "next_token" "text" DEFAULT ''::"text", "sort_order" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "metadata" "jsonb", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix, 1) = delimiter_param THEN
        v_upper_bound := left(v_prefix, -1) || chr(ascii(delimiter_param) + 1);
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'AND o.name COLLATE "C" < $3 ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'AND o.name COLLATE "C" >= $3 ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor: find the last item in range
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Cursor provided: determine if it refers to a folder or leaf
        IF EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = _bucket_id
              AND o.name COLLATE "C" LIKE v_start || delimiter_param || '%'
            LIMIT 1
        ) THEN
            -- Cursor refers to a folder
            IF v_is_asc THEN
                v_next_seek := v_start || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_start || delimiter_param;
            END IF;
        ELSE
            -- Cursor refers to a leaf object
            IF v_is_asc THEN
                v_next_seek := v_start || delimiter_param;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := rtrim(v_common_prefix, delimiter_param);
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1) || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := v_current.name;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                RETURN NEXT;
                v_count := v_count + 1;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := v_current.name || delimiter_param;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


ALTER FUNCTION "storage"."list_objects_with_delimiter"("_bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer, "start_after" "text", "next_token" "text", "sort_order" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."operation"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


ALTER FUNCTION "storage"."operation"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."protect_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "storage"."protect_delete"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search"("prefix" "text", "bucketname" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "offsets" integer DEFAULT 0, "search" "text" DEFAULT ''::"text", "sortcolumn" "text" DEFAULT 'name'::"text", "sortorder" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;
    v_skipped INT := 0;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach (unchanged)
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT path_tokens[$1] AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $2 || '%%'
                  AND bucket_id = $3
                  AND array_length(objects.path_tokens, 1) <> $1
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata FROM folders)
            UNION ALL
            (SELECT path_tokens[$1] AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata
             FROM storage.objects
             WHERE objects.name ILIKE $2 || '%%'
               AND bucket_id = $3
               AND array_length(objects.path_tokens, 1) = $1
             ORDER BY %I %s)
            LIMIT $4 OFFSET $5
            $sql$, v_sort_order, v_order_by, v_sort_order
        ) USING levels, v_prefix, bucketname, v_limit, offsets;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'AND lower(o.name) COLLATE "C" < $3 ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'AND lower(o.name) COLLATE "C" >= $3 ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC: find the last item in range first (static SQL)
        IF v_upper_bound IS NOT NULL THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower AND lower(o.name) COLLATE "C" < v_upper_bound
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSIF v_prefix_lower <> '' THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSE
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        END IF;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix_lower <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := split_part(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter), v_delimiter, levels);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := lower(v_current.name);
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := split_part(v_current.name, v_delimiter, levels);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := lower(v_current.name) || v_delimiter;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


ALTER FUNCTION "storage"."search"("prefix" "text", "bucketname" "text", "limits" integer, "levels" integer, "offsets" integer, "search" "text", "sortcolumn" "text", "sortorder" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_by_timestamp"("p_prefix" "text", "p_bucket_id" "text", "p_limit" integer, "p_level" integer, "p_start_after" "text", "p_sort_order" "text", "p_sort_column" "text", "p_sort_column_after" "text") RETURNS TABLE("key" "text", "name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
BEGIN
    v_prefix := coalesce(p_prefix, '');

    IF p_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $1 || '%%'
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                rtrim(common_prefix, '/') AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    date_trunc('milliseconds', %I),
                    name COLLATE "C"
                ) %s ROW(
                    COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz),
                    $5
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s
        LIMIT $4
    $sql$,
        p_sort_column,
        v_cursor_op,
        p_sort_column,
        p_sort_order,
        p_sort_order
    );

    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after;
END;
$_$;


ALTER FUNCTION "storage"."search_by_timestamp"("p_prefix" "text", "p_bucket_id" "text", "p_limit" integer, "p_level" integer, "p_start_after" "text", "p_sort_order" "text", "p_sort_column" "text", "p_sort_column_after" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_v2"("prefix" "text", "bucket_name" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "start_after" "text" DEFAULT ''::"text", "sort_order" "text" DEFAULT 'asc'::"text", "sort_column" "text" DEFAULT 'name'::"text", "sort_column_after" "text" DEFAULT ''::"text") RETURNS TABLE("key" "text", "name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            start_after,
            '',
            v_sort_ord
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after
        );
    END IF;
END;
$$;


ALTER FUNCTION "storage"."search_v2"("prefix" "text", "bucket_name" "text", "limits" integer, "levels" integer, "start_after" "text", "sort_order" "text", "sort_column" "text", "sort_column_after" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


ALTER FUNCTION "storage"."update_updated_at_column"() OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text",
    "display_name" "text",
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL
);


ALTER TABLE "public"."contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."friend_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "from_user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "to_user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "responded_at" timestamp with time zone,
    CONSTRAINT "friend_requests_check" CHECK (("from_user_id" <> "to_user_id")),
    CONSTRAINT "friend_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'denied'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."friend_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."friendships" (
    "request_user_id" "uuid" NOT NULL,
    "response_user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "request_id" "uuid"
);


ALTER TABLE "public"."friendships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tour_partners" (
    "tour_id" "uuid" NOT NULL,
    "contact_id" "uuid" NOT NULL
);


ALTER TABLE "public"."tour_partners" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tours" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "planned_date" "date",
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "goal" "extensions"."geography"(Point,4326) NOT NULL,
    "name" "text",
    "tour_type" "text",
    "elevation" numeric,
    "description" "text",
    "seasons" "text"[],
    "start_point" "extensions"."geography"(Point,4326),
    "end_point" "extensions"."geography"(Point,4326),
    "equipment" "text",
    "notes" "text",
    "completed" boolean DEFAULT false NOT NULL,
    "start_point_name" "text",
    "start_point_elevation" integer,
    "end_point_name" "text",
    "end_point_elevation" integer,
    "gpx_filepath" "text",
    CONSTRAINT "tours_name_check" CHECK (("length"("name") < 100)),
    CONSTRAINT "tours_tour_type_check" CHECK ((("tour_type" IS NULL) OR ("tour_type" = ANY (ARRAY['skiing'::"text", 'snowboarding'::"text", 'skitour'::"text", 'splitboarding'::"text", 'ski-mountaineering'::"text", 'paragliding'::"text", 'hiking'::"text", 'mountaineering'::"text", 'climbing'::"text", 'mountain-biking'::"text", 'trailrunning'::"text"]))))
);


ALTER TABLE "public"."tours" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."tours_view" AS
 SELECT "id",
    "user_id",
    "planned_date",
    "name",
    "extensions"."st_x"(("goal")::"extensions"."geometry") AS "lon",
    "extensions"."st_y"(("goal")::"extensions"."geometry") AS "lat",
    "tour_type",
    "elevation",
    "gpx_filepath",
    "description",
    "seasons",
    "extensions"."st_x"(("start_point")::"extensions"."geometry") AS "start_lon",
    "extensions"."st_y"(("start_point")::"extensions"."geometry") AS "start_lat",
    "extensions"."st_x"(("end_point")::"extensions"."geometry") AS "end_lon",
    "extensions"."st_y"(("end_point")::"extensions"."geometry") AS "end_lat",
    "start_point_name",
    "start_point_elevation",
    "end_point_name",
    "end_point_elevation",
    "equipment",
    "notes",
    "completed",
    ( SELECT COALESCE("json_agg"("tp"."contact_id"), '[]'::json) AS "coalesce"
           FROM "public"."tour_partners" "tp"
          WHERE ("tp"."tour_id" = "t"."id")) AS "partner_ids"
   FROM "public"."tours" "t";


ALTER VIEW "public"."tours_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profile" (
    "id" "uuid" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "locale" "text",
    "notif_push_enabled" boolean DEFAULT true NOT NULL,
    "notif_email_enabled" boolean DEFAULT true NOT NULL,
    "notif_muted_types" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    CONSTRAINT "user_profile_locale_check" CHECK ((("locale" IS NULL) OR ("locale" = ANY (ARRAY['en'::"text", 'de-CH'::"text"]))))
);


ALTER TABLE "public"."user_profile" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "storage"."buckets" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "owner" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "public" boolean DEFAULT false,
    "avif_autodetection" boolean DEFAULT false,
    "file_size_limit" bigint,
    "allowed_mime_types" "text"[],
    "owner_id" "text",
    "type" "storage"."buckettype" DEFAULT 'STANDARD'::"storage"."buckettype" NOT NULL
);


ALTER TABLE "storage"."buckets" OWNER TO "supabase_storage_admin";


COMMENT ON COLUMN "storage"."buckets"."owner" IS 'Field is deprecated, use owner_id instead';



CREATE TABLE IF NOT EXISTS "storage"."buckets_analytics" (
    "name" "text" NOT NULL,
    "type" "storage"."buckettype" DEFAULT 'ANALYTICS'::"storage"."buckettype" NOT NULL,
    "format" "text" DEFAULT 'ICEBERG'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "storage"."buckets_analytics" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."buckets_vectors" (
    "id" "text" NOT NULL,
    "type" "storage"."buckettype" DEFAULT 'VECTOR'::"storage"."buckettype" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."buckets_vectors" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."migrations" (
    "id" integer NOT NULL,
    "name" character varying(100) NOT NULL,
    "hash" character varying(40) NOT NULL,
    "executed_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "storage"."migrations" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."objects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bucket_id" "text",
    "name" "text",
    "owner" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_accessed_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb",
    "path_tokens" "text"[] GENERATED ALWAYS AS ("string_to_array"("name", '/'::"text")) STORED,
    "version" "text",
    "owner_id" "text",
    "user_metadata" "jsonb"
);


ALTER TABLE "storage"."objects" OWNER TO "supabase_storage_admin";


COMMENT ON COLUMN "storage"."objects"."owner" IS 'Field is deprecated, use owner_id instead';



CREATE TABLE IF NOT EXISTS "storage"."s3_multipart_uploads" (
    "id" "text" NOT NULL,
    "in_progress_size" bigint DEFAULT 0 NOT NULL,
    "upload_signature" "text" NOT NULL,
    "bucket_id" "text" NOT NULL,
    "key" "text" NOT NULL COLLATE "pg_catalog"."C",
    "version" "text" NOT NULL,
    "owner_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_metadata" "jsonb",
    "metadata" "jsonb"
);


ALTER TABLE "storage"."s3_multipart_uploads" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."s3_multipart_uploads_parts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "upload_id" "text" NOT NULL,
    "size" bigint DEFAULT 0 NOT NULL,
    "part_number" integer NOT NULL,
    "bucket_id" "text" NOT NULL,
    "key" "text" NOT NULL COLLATE "pg_catalog"."C",
    "etag" "text" NOT NULL,
    "owner_id" "text",
    "version" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."s3_multipart_uploads_parts" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."vector_indexes" (
    "id" "text" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL COLLATE "pg_catalog"."C",
    "bucket_id" "text" NOT NULL,
    "data_type" "text" NOT NULL,
    "dimension" integer NOT NULL,
    "distance_metric" "text" NOT NULL,
    "metadata_configuration" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."vector_indexes" OWNER TO "supabase_storage_admin";


ALTER TABLE ONLY "public"."contact_methods"
    ADD CONSTRAINT "contact_methods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_methods"
    ADD CONSTRAINT "contact_methods_unique_per_contact" UNIQUE ("contact_id", "method_type", "value");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."friend_requests"
    ADD CONSTRAINT "friend_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_pkey" PRIMARY KEY ("request_user_id", "response_user_id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE ("endpoint");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tour_partners"
    ADD CONSTRAINT "tour_partners_pkey" PRIMARY KEY ("tour_id", "contact_id");



ALTER TABLE ONLY "public"."tours"
    ADD CONSTRAINT "tours_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profile"
    ADD CONSTRAINT "user_profile_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."buckets_analytics"
    ADD CONSTRAINT "buckets_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."buckets"
    ADD CONSTRAINT "buckets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."buckets_vectors"
    ADD CONSTRAINT "buckets_vectors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."migrations"
    ADD CONSTRAINT "migrations_name_key" UNIQUE ("name");



ALTER TABLE ONLY "storage"."migrations"
    ADD CONSTRAINT "migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."objects"
    ADD CONSTRAINT "objects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads"
    ADD CONSTRAINT "s3_multipart_uploads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."vector_indexes"
    ADD CONSTRAINT "vector_indexes_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "contact_methods_one_primary_email" ON "public"."contact_methods" USING "btree" ("contact_id") WHERE (("method_type" = 'email'::"public"."contact_method_type") AND "is_primary");



CREATE UNIQUE INDEX "contact_methods_one_primary_phone" ON "public"."contact_methods" USING "btree" ("contact_id") WHERE (("method_type" = 'phone'::"public"."contact_method_type") AND "is_primary");



CREATE UNIQUE INDEX "friend_requests_pending_pair_idx" ON "public"."friend_requests" USING "btree" ("from_user_id", "to_user_id") WHERE ("status" = 'pending'::"text");



CREATE UNIQUE INDEX "friendships_unordered_pair_idx" ON "public"."friendships" USING "btree" (LEAST("request_user_id", "response_user_id"), GREATEST("request_user_id", "response_user_id"));



CREATE INDEX "push_subscriptions_user_id_idx" ON "public"."push_subscriptions" USING "btree" ("user_id");



CREATE INDEX "tour_partners_contact_id_idx" ON "public"."tour_partners" USING "btree" ("contact_id");



CREATE UNIQUE INDEX "bname" ON "storage"."buckets" USING "btree" ("name");



CREATE UNIQUE INDEX "bucketid_objname" ON "storage"."objects" USING "btree" ("bucket_id", "name");



CREATE UNIQUE INDEX "buckets_analytics_unique_name_idx" ON "storage"."buckets_analytics" USING "btree" ("name") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_multipart_uploads_list" ON "storage"."s3_multipart_uploads" USING "btree" ("bucket_id", "key", "created_at");



CREATE INDEX "idx_objects_bucket_id_name" ON "storage"."objects" USING "btree" ("bucket_id", "name" COLLATE "C");



CREATE INDEX "idx_objects_bucket_id_name_lower" ON "storage"."objects" USING "btree" ("bucket_id", "lower"("name") COLLATE "C");



CREATE INDEX "name_prefix_search" ON "storage"."objects" USING "btree" ("name" "text_pattern_ops");



CREATE UNIQUE INDEX "vector_indexes_name_bucket_id_idx" ON "storage"."vector_indexes" USING "btree" ("name", "bucket_id");



CREATE OR REPLACE TRIGGER "enforce_bucket_name_length_trigger" BEFORE INSERT OR UPDATE OF "name" ON "storage"."buckets" FOR EACH ROW EXECUTE FUNCTION "storage"."enforce_bucket_name_length"();



CREATE OR REPLACE TRIGGER "protect_buckets_delete" BEFORE DELETE ON "storage"."buckets" FOR EACH STATEMENT EXECUTE FUNCTION "storage"."protect_delete"();



CREATE OR REPLACE TRIGGER "protect_objects_delete" BEFORE DELETE ON "storage"."objects" FOR EACH STATEMENT EXECUTE FUNCTION "storage"."protect_delete"();



CREATE OR REPLACE TRIGGER "update_objects_updated_at" BEFORE UPDATE ON "storage"."objects" FOR EACH ROW EXECUTE FUNCTION "storage"."update_updated_at_column"();



ALTER TABLE ONLY "public"."contact_methods"
    ADD CONSTRAINT "contact_methods_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friend_requests"
    ADD CONSTRAINT "friend_requests_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friend_requests"
    ADD CONSTRAINT "friend_requests_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."friend_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_user_a_id_fkey" FOREIGN KEY ("request_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_user_b_id_fkey" FOREIGN KEY ("response_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tour_partners"
    ADD CONSTRAINT "tour_partners_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tour_partners"
    ADD CONSTRAINT "tour_partners_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tours"
    ADD CONSTRAINT "tours_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profile"
    ADD CONSTRAINT "user_profile_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "storage"."objects"
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads"
    ADD CONSTRAINT "s3_multipart_uploads_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "storage"."s3_multipart_uploads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "storage"."vector_indexes"
    ADD CONSTRAINT "vector_indexes_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets_vectors"("id");



CREATE POLICY "Users can manage their own push subscriptions" ON "public"."push_subscriptions" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."contact_methods" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "contact_methods_delete_own" ON "public"."contact_methods" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."contacts" "c"
  WHERE (("c"."id" = "contact_methods"."contact_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "contact_methods_insert_own" ON "public"."contact_methods" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."contacts" "c"
  WHERE (("c"."id" = "contact_methods"."contact_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "contact_methods_select_own" ON "public"."contact_methods" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."contacts" "c"
  WHERE (("c"."id" = "contact_methods"."contact_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "contact_methods_update_own" ON "public"."contact_methods" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."contacts" "c"
  WHERE (("c"."id" = "contact_methods"."contact_id") AND ("c"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."contacts" "c"
  WHERE (("c"."id" = "contact_methods"."contact_id") AND ("c"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "contacts_delete_own" ON "public"."contacts" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "contacts_insert_own" ON "public"."contacts" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "contacts_select_own" ON "public"."contacts" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "contacts_update_own" ON "public"."contacts" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."friend_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "friend_requests_insert" ON "public"."friend_requests" FOR INSERT WITH CHECK ((("auth"."uid"() = "from_user_id") AND "public"."is_phone_verified"("auth"."uid"()) AND "public"."is_phone_verified"("to_user_id")));



CREATE POLICY "friend_requests_select" ON "public"."friend_requests" FOR SELECT USING ((("auth"."uid"() = "from_user_id") OR ("auth"."uid"() = "to_user_id")));



CREATE POLICY "friend_requests_update_recipient" ON "public"."friend_requests" FOR UPDATE USING ((("auth"."uid"() = "to_user_id") AND ("status" = 'pending'::"text"))) WITH CHECK (("status" = ANY (ARRAY['accepted'::"text", 'denied'::"text"])));



CREATE POLICY "friend_requests_update_sender" ON "public"."friend_requests" FOR UPDATE USING ((("auth"."uid"() = "from_user_id") AND ("status" = 'pending'::"text"))) WITH CHECK (("status" = 'cancelled'::"text"));



ALTER TABLE "public"."friendships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "friendships_select" ON "public"."friendships" FOR SELECT USING ((("auth"."uid"() = "request_user_id") OR ("auth"."uid"() = "response_user_id")));



ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tour_partners" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tour_partners_delete_own" ON "public"."tour_partners" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."tours" "t"
  WHERE (("t"."id" = "tour_partners"."tour_id") AND ("t"."user_id" = "auth"."uid"())))));



CREATE POLICY "tour_partners_insert_own" ON "public"."tour_partners" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tours" "t"
  WHERE (("t"."id" = "tour_partners"."tour_id") AND ("t"."user_id" = "auth"."uid"())))));



CREATE POLICY "tour_partners_select_own" ON "public"."tour_partners" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."tours" "t"
  WHERE (("t"."id" = "tour_partners"."tour_id") AND ("t"."user_id" = "auth"."uid"())))));



CREATE POLICY "tour_partners_update_own" ON "public"."tour_partners" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."tours" "t"
  WHERE (("t"."id" = "tour_partners"."tour_id") AND ("t"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tours" "t"
  WHERE (("t"."id" = "tour_partners"."tour_id") AND ("t"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."tours" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tours_delete_own" ON "public"."tours" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "tours_insert_own" ON "public"."tours" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "tours_select_own" ON "public"."tours" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "tours_update_own" ON "public"."tours" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."user_profile" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_profile_insert_own" ON "public"."user_profile" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "user_profile_select_own" ON "public"."user_profile" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "user_profile_update_own" ON "public"."user_profile" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "storage"."buckets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."buckets_analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."buckets_vectors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."objects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."s3_multipart_uploads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."s3_multipart_uploads_parts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tour-gpx owner delete" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'tour-gpx'::"text") AND ("split_part"("name", '/'::"text", 1) = ("auth"."uid"())::"text")));



CREATE POLICY "tour-gpx owner insert" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'tour-gpx'::"text") AND ("split_part"("name", '/'::"text", 1) = ("auth"."uid"())::"text")));



CREATE POLICY "tour-gpx owner select" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'tour-gpx'::"text") AND ("split_part"("name", '/'::"text", 1) = ("auth"."uid"())::"text")));



CREATE POLICY "tour-gpx owner update" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'tour-gpx'::"text") AND ("split_part"("name", '/'::"text", 1) = ("auth"."uid"())::"text"))) WITH CHECK ((("bucket_id" = 'tour-gpx'::"text") AND ("split_part"("name", '/'::"text", 1) = ("auth"."uid"())::"text")));



ALTER TABLE "storage"."vector_indexes" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT USAGE ON SCHEMA "storage" TO "postgres" WITH GRANT OPTION;
GRANT USAGE ON SCHEMA "storage" TO "anon";
GRANT USAGE ON SCHEMA "storage" TO "authenticated";
GRANT USAGE ON SCHEMA "storage" TO "service_role";
GRANT ALL ON SCHEMA "storage" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON SCHEMA "storage" TO "dashboard_user";



GRANT ALL ON FUNCTION "public"."accept_friend_request"("p_request_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_friend_request"("p_request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_friend_request"("p_request_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_tour_full"("p_id" "uuid", "p_planned_date" "date", "p_name" "text", "p_goal" "text", "p_partner_ids" "uuid"[], "p_tour_type" "text", "p_elevation" numeric, "p_gpx_filepath" "text", "p_description" "text", "p_seasons" "text"[], "p_start_point" "text", "p_end_point" "text", "p_equipment" "text", "p_notes" "text", "p_start_point_name" "text", "p_start_point_elevation" integer, "p_end_point_name" "text", "p_end_point_elevation" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."create_tour_full"("p_id" "uuid", "p_planned_date" "date", "p_name" "text", "p_goal" "text", "p_partner_ids" "uuid"[], "p_tour_type" "text", "p_elevation" numeric, "p_gpx_filepath" "text", "p_description" "text", "p_seasons" "text"[], "p_start_point" "text", "p_end_point" "text", "p_equipment" "text", "p_notes" "text", "p_start_point_name" "text", "p_start_point_elevation" integer, "p_end_point_name" "text", "p_end_point_elevation" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_tour_full"("p_id" "uuid", "p_planned_date" "date", "p_name" "text", "p_goal" "text", "p_partner_ids" "uuid"[], "p_tour_type" "text", "p_elevation" numeric, "p_gpx_filepath" "text", "p_description" "text", "p_seasons" "text"[], "p_start_point" "text", "p_end_point" "text", "p_equipment" "text", "p_notes" "text", "p_start_point_name" "text", "p_start_point_elevation" integer, "p_end_point_name" "text", "p_end_point_elevation" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."find_phones_by_user_ids"("p_user_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."find_phones_by_user_ids"("p_user_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_phones_by_user_ids"("p_user_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."find_user_by_phone"("p_phone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."find_user_by_phone"("p_phone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_user_by_phone"("p_phone" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."find_users_by_phones"("p_phones" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."find_users_by_phones"("p_phones" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_users_by_phones"("p_phones" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_phone_verified"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_phone_verified"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_phone_verified"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_friendship"("p_other_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_friendship"("p_other_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_friendship"("p_other_user_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."contact_methods" TO "anon";
GRANT ALL ON TABLE "public"."contact_methods" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_methods" TO "service_role";



GRANT ALL ON FUNCTION "public"."set_primary_phone"("p_contact_id" "uuid", "p_method_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."set_primary_phone"("p_contact_id" "uuid", "p_method_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_primary_phone"("p_contact_id" "uuid", "p_method_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_tour_full"("p_id" "uuid", "p_planned_date" "date", "p_name" "text", "p_goal" "text", "p_partner_ids" "uuid"[], "p_tour_type" "text", "p_elevation" numeric, "p_gpx_filepath" "text", "p_description" "text", "p_seasons" "text"[], "p_start_point" "text", "p_end_point" "text", "p_equipment" "text", "p_notes" "text", "p_start_point_name" "text", "p_start_point_elevation" integer, "p_end_point_name" "text", "p_end_point_elevation" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_tour_full"("p_id" "uuid", "p_planned_date" "date", "p_name" "text", "p_goal" "text", "p_partner_ids" "uuid"[], "p_tour_type" "text", "p_elevation" numeric, "p_gpx_filepath" "text", "p_description" "text", "p_seasons" "text"[], "p_start_point" "text", "p_end_point" "text", "p_equipment" "text", "p_notes" "text", "p_start_point_name" "text", "p_start_point_elevation" integer, "p_end_point_name" "text", "p_end_point_elevation" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_tour_full"("p_id" "uuid", "p_planned_date" "date", "p_name" "text", "p_goal" "text", "p_partner_ids" "uuid"[], "p_tour_type" "text", "p_elevation" numeric, "p_gpx_filepath" "text", "p_description" "text", "p_seasons" "text"[], "p_start_point" "text", "p_end_point" "text", "p_equipment" "text", "p_notes" "text", "p_start_point_name" "text", "p_start_point_elevation" integer, "p_end_point_name" "text", "p_end_point_elevation" integer) TO "service_role";



GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role";



GRANT ALL ON TABLE "public"."friend_requests" TO "anon";
GRANT ALL ON TABLE "public"."friend_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."friend_requests" TO "service_role";



GRANT ALL ON TABLE "public"."friendships" TO "anon";
GRANT ALL ON TABLE "public"."friendships" TO "authenticated";
GRANT ALL ON TABLE "public"."friendships" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."tour_partners" TO "anon";
GRANT ALL ON TABLE "public"."tour_partners" TO "authenticated";
GRANT ALL ON TABLE "public"."tour_partners" TO "service_role";



GRANT ALL ON TABLE "public"."tours" TO "anon";
GRANT ALL ON TABLE "public"."tours" TO "authenticated";
GRANT ALL ON TABLE "public"."tours" TO "service_role";



GRANT ALL ON TABLE "public"."tours_view" TO "anon";
GRANT ALL ON TABLE "public"."tours_view" TO "authenticated";
GRANT ALL ON TABLE "public"."tours_view" TO "service_role";



GRANT ALL ON TABLE "public"."user_profile" TO "anon";
GRANT ALL ON TABLE "public"."user_profile" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profile" TO "service_role";



REVOKE ALL ON TABLE "storage"."buckets" FROM "supabase_storage_admin";
GRANT ALL ON TABLE "storage"."buckets" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON TABLE "storage"."buckets" TO "service_role";
GRANT ALL ON TABLE "storage"."buckets" TO "authenticated";
GRANT ALL ON TABLE "storage"."buckets" TO "anon";
GRANT ALL ON TABLE "storage"."buckets" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "storage"."buckets_analytics" TO "service_role";
GRANT ALL ON TABLE "storage"."buckets_analytics" TO "authenticated";
GRANT ALL ON TABLE "storage"."buckets_analytics" TO "anon";



GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "service_role";
GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "authenticated";
GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "anon";



REVOKE ALL ON TABLE "storage"."objects" FROM "supabase_storage_admin";
GRANT ALL ON TABLE "storage"."objects" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON TABLE "storage"."objects" TO "service_role";
GRANT ALL ON TABLE "storage"."objects" TO "authenticated";
GRANT ALL ON TABLE "storage"."objects" TO "anon";
GRANT ALL ON TABLE "storage"."objects" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "storage"."s3_multipart_uploads" TO "service_role";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads" TO "authenticated";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads" TO "anon";



GRANT ALL ON TABLE "storage"."s3_multipart_uploads_parts" TO "service_role";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads_parts" TO "authenticated";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads_parts" TO "anon";



GRANT SELECT ON TABLE "storage"."vector_indexes" TO "service_role";
GRANT SELECT ON TABLE "storage"."vector_indexes" TO "authenticated";
GRANT SELECT ON TABLE "storage"."vector_indexes" TO "anon";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "service_role";




