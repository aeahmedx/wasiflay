-- =====================================================================
-- WASIF LAY — v1 initial schema
-- Target: Supabase (Postgres 15+)
-- Run once in the Supabase SQL editor, or save as
--   supabase/migrations/0001_init.sql
--
-- Conventions
--   * UUID primary keys, gen_random_uuid()
--   * created_at / updated_at on every table
--   * Soft delete only. Nothing is hard-deleted in v1.
--   * RLS on for every table, from the start.
--   * Full-text search uses the 'simple' config (NOT 'english') so that
--     mixed Arabic/English content is not mangled by English stemming.
-- =====================================================================

begin;

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "unaccent";


-- =====================================================================
-- 1. ENUMS
-- =====================================================================

do $enum$ begin
  create type user_role as enum ('member', 'moderator', 'admin');
exception when duplicate_object then null;
end $enum$;
do $enum$ begin
  create type post_type as enum ('question', 'recommendation', 'announcement');
exception when duplicate_object then null;
end $enum$;
do $enum$ begin
  create type vote_target as enum ('post', 'answer');
exception when duplicate_object then null;
end $enum$;
do $enum$ begin
  create type room_type as enum ('general', 'match', 'event');
exception when duplicate_object then null;
end $enum$;
do $enum$ begin
  create type report_target as enum ('post', 'answer', 'message', 'listing', 'profile');
exception when duplicate_object then null;
end $enum$;
do $enum$ begin
  create type report_status as enum ('open', 'actioned', 'dismissed');
exception when duplicate_object then null;
end $enum$;


-- =====================================================================
-- 2. PROFILES
--    One row per authenticated user. id == auth.users.id
-- =====================================================================

create table if not exists profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  display_name       text        not null check (char_length(trim(display_name)) between 2 and 50),
  city               text,
  country_flag       text        default 'SD',          -- ISO-3166 alpha-2
  date_of_birth      date        not null,
  is_minor           boolean     not null default false, -- maintained by trigger
  show_city          boolean     not null default true,  -- forced false for minors
  role               user_role   not null default 'member',
  contribution_count integer     not null default 0,
  helpful_count      integer     not null default 0,
  is_banned          boolean     not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on column profiles.is_minor is
  'Set by trigger from date_of_birth. Under-18 accounts never expose city publicly.';


-- =====================================================================
-- 3. POSTS  (the permanent layer)
-- =====================================================================

create table if not exists posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid        not null references profiles(id) on delete cascade,
  type          post_type   not null default 'question',
  title         text        not null check (char_length(trim(title)) between 5 and 200),
  body          text        not null default '' check (char_length(body) <= 10000),
  city          text,
  is_anonymous  boolean     not null default false,
  answer_count  integer     not null default 0,
  helpful_count integer     not null default 0,
  is_removed    boolean     not null default false,
  removed_by    uuid        references profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  search_tsv    tsvector generated always as (
                  to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(body,''))
                ) stored
);


-- =====================================================================
-- 4. ANSWERS
-- =====================================================================

create table if not exists answers (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid        not null references posts(id) on delete cascade,
  author_id     uuid        not null references profiles(id) on delete cascade,
  body          text        not null check (char_length(trim(body)) between 1 and 10000),
  is_anonymous  boolean     not null default false,
  helpful_count integer     not null default 0,
  is_removed    boolean     not null default false,
  removed_by    uuid        references profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);


-- =====================================================================
-- 5. VOTES  (one "helpful" vote per user per target)
-- =====================================================================

create table if not exists votes (
  id          uuid primary key default gen_random_uuid(),
  voter_id    uuid        not null references profiles(id) on delete cascade,
  target_type vote_target not null,
  target_id   uuid        not null,
  created_at  timestamptz not null default now(),
  unique (voter_id, target_type, target_id)
);


-- =====================================================================
-- 6. LISTINGS  (people & businesses — community-submitted, NOT verified)
-- =====================================================================

create table if not exists listings (
  id             uuid primary key default gen_random_uuid(),
  submitted_by   uuid        not null references profiles(id) on delete cascade,
  claimed_by     uuid        references profiles(id),      -- if the subject claims it
  name           text        not null check (char_length(trim(name)) between 2 and 120),
  service_tag    text        not null,                     -- 'lawyer', 'mechanic', 'tutor'
  city           text,
  description    text        default '' check (char_length(description) <= 2000),
  contact_phone  text,
  contact_email  text,
  search_aliases text        default '',                   -- 'Ahmad Ahmet Muhammad'
  vouch_count    integer     not null default 0,
  is_removed     boolean     not null default false,
  removed_by     uuid        references profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  search_tsv     tsvector generated always as (
                   to_tsvector('simple',
                     coalesce(name,'') || ' ' ||
                     coalesce(service_tag,'') || ' ' ||
                     coalesce(city,'') || ' ' ||
                     coalesce(description,'') || ' ' ||
                     coalesce(search_aliases,''))
                 ) stored
);

comment on table listings is
  'Community-submitted. Wasif Lay does not verify credentials. Surface this in UI.';


-- =====================================================================
-- 7. VOUCHES
-- =====================================================================

create table if not exists vouches (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid        not null references listings(id) on delete cascade,
  voucher_id uuid        not null references profiles(id) on delete cascade,
  note       text        check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  unique (listing_id, voucher_id)
);


-- =====================================================================
-- 8. ROOMS  (the live layer)
-- =====================================================================

create table if not exists rooms (
  id          uuid primary key default gen_random_uuid(),
  slug        text        not null unique,
  name        text        not null,
  type        room_type   not null default 'general',
  is_open     boolean     not null default true,
  is_archived boolean     not null default false,
  opens_at    timestamptz,
  closes_at   timestamptz,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);


-- =====================================================================
-- 9. MESSAGES
-- =====================================================================

create table if not exists messages (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid        not null references rooms(id) on delete cascade,
  author_id      uuid        not null references profiles(id) on delete cascade,
  body           text        default '' check (char_length(body) <= 1000),
  image_url      text,
  saved_post_id  uuid        references posts(id),      -- "save to community"
  saved_listing_id uuid      references listings(id),
  is_removed     boolean     not null default false,
  removed_by     uuid        references profiles(id),
  created_at     timestamptz not null default now(),
  check (char_length(trim(coalesce(body,''))) > 0 or image_url is not null)
);


-- =====================================================================
-- 10. REPORTS
-- =====================================================================

create table if not exists reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid          not null references profiles(id) on delete cascade,
  target_type  report_target not null,
  target_id    uuid          not null,
  reason       text          not null check (char_length(trim(reason)) between 1 and 500),
  status       report_status not null default 'open',
  handled_by   uuid          references profiles(id),
  handled_at   timestamptz,
  created_at   timestamptz   not null default now()
);


-- =====================================================================
-- 11. NOTIFICATIONS  (v1 fires on exactly one event: your post got an answer)
-- =====================================================================

create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid        not null references profiles(id) on delete cascade,
  kind        text        not null default 'answer_received',
  post_id     uuid        references posts(id) on delete cascade,
  answer_id   uuid        references answers(id) on delete cascade,
  actor_id    uuid        references profiles(id),
  is_read     boolean     not null default false,
  sms_sent_at timestamptz,
  created_at  timestamptz not null default now()
);


-- =====================================================================
-- 12. INDEXES
-- =====================================================================

create index if not exists idx_posts_created on posts (created_at desc) where not is_removed;
create index if not exists idx_posts_city on posts (city, created_at desc) where not is_removed;
create index if not exists idx_posts_author on posts (author_id);
create index if not exists idx_posts_tsv on posts using gin (search_tsv);
create index if not exists idx_posts_title_trgm on posts using gin (title gin_trgm_ops);

create index if not exists idx_answers_post on answers (post_id, created_at) where not is_removed;
create index if not exists idx_answers_author on answers (author_id);

create index if not exists idx_votes_target on votes (target_type, target_id);

create index if not exists idx_listings_tag_city on listings (service_tag, city) where not is_removed;
create index if not exists idx_listings_tsv on listings using gin (search_tsv);
create index if not exists idx_listings_name_trgm on listings using gin (name gin_trgm_ops);

create index if not exists idx_vouches_listing on vouches (listing_id);

create index if not exists idx_messages_room on messages (room_id, created_at desc) where not is_removed;

create index if not exists idx_reports_open on reports (status, created_at desc) where status = 'open';

create index if not exists idx_notifications_user on notifications (user_id, created_at desc) where not is_read;


-- =====================================================================
-- 13. HELPER FUNCTIONS
--     SECURITY DEFINER so RLS policies can call them without recursing
--     back into the profiles table.
-- =====================================================================

create or replace function is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('moderator','admin') and not is_banned
  );
$$;

create or replace function is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin' and not is_banned
  );
$$;

create or replace function is_active_user()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and not is_banned
  );
$$;


-- =====================================================================
-- 14. TRIGGERS
-- =====================================================================

-- 14a. updated_at ------------------------------------------------------
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists t_profiles_touch on profiles;
create trigger t_profiles_touch before update on profiles
  for each row execute function touch_updated_at();
drop trigger if exists t_posts_touch on posts;
create trigger t_posts_touch    before update on posts
  for each row execute function touch_updated_at();
drop trigger if exists t_answers_touch on answers;
create trigger t_answers_touch  before update on answers
  for each row execute function touch_updated_at();
drop trigger if exists t_listings_touch on listings;
create trigger t_listings_touch before update on listings
  for each row execute function touch_updated_at();
drop trigger if exists t_rooms_touch on rooms;
create trigger t_rooms_touch    before update on rooms
  for each row execute function touch_updated_at();


-- 14b. minor status ----------------------------------------------------
create or replace function set_minor_status()
returns trigger language plpgsql as $$
begin
  new.is_minor := (new.date_of_birth > (current_date - interval '18 years'));
  if new.is_minor then
    new.show_city := false;      -- under-18 accounts never expose city
  end if;
  return new;
end;
$$;

drop trigger if exists t_profiles_minor on profiles;
create trigger t_profiles_minor before insert or update on profiles
  for each row execute function set_minor_status();


-- 14c. answer counts ---------------------------------------------------
create or replace function sync_answer_count()
returns trigger language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  target := coalesce(new.post_id, old.post_id);
  update posts p set answer_count = (
    select count(*) from answers a where a.post_id = target and not a.is_removed
  ) where p.id = target;
  return null;
end;
$$;

drop trigger if exists t_answers_count on answers;
create trigger t_answers_count after insert or update of is_removed or delete on answers
  for each row execute function sync_answer_count();


-- 14d. vote counts + profile helpful_count -----------------------------
create or replace function sync_vote_counts()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  t_type vote_target;
  t_id   uuid;
  owner  uuid;
begin
  t_type := coalesce(new.target_type, old.target_type);
  t_id   := coalesce(new.target_id,   old.target_id);

  if t_type = 'answer' then
    update answers set helpful_count = (
      select count(*) from votes v
      where v.target_type = 'answer' and v.target_id = t_id
    ) where id = t_id
    returning author_id into owner;
  else
    update posts set helpful_count = (
      select count(*) from votes v
      where v.target_type = 'post' and v.target_id = t_id
    ) where id = t_id
    returning author_id into owner;
  end if;

  if owner is not null then
    update profiles set helpful_count = (
      select coalesce(count(*),0) from votes v
      join answers a on a.id = v.target_id and v.target_type = 'answer'
      where a.author_id = owner and not a.is_removed
    ) where id = owner;
  end if;

  return null;
end;
$$;

drop trigger if exists t_votes_count on votes;
create trigger t_votes_count after insert or delete on votes
  for each row execute function sync_vote_counts();


-- 14e. vouch counts ----------------------------------------------------
create or replace function sync_vouch_count()
returns trigger language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  target := coalesce(new.listing_id, old.listing_id);
  update listings set vouch_count = (
    select count(*) from vouches where listing_id = target
  ) where id = target;
  return null;
end;
$$;

drop trigger if exists t_vouches_count on vouches;
create trigger t_vouches_count after insert or delete on vouches
  for each row execute function sync_vouch_count();


-- 14f. contribution count ---------------------------------------------
create or replace function sync_contribution_count()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  owner := coalesce(new.author_id, old.author_id);
  update profiles set contribution_count = (
      (select count(*) from posts   where author_id = owner and not is_removed)
    + (select count(*) from answers where author_id = owner and not is_removed)
  ) where id = owner;
  return null;
end;
$$;

drop trigger if exists t_posts_contrib on posts;
create trigger t_posts_contrib after insert or update of is_removed or delete on posts
  for each row execute function sync_contribution_count();
drop trigger if exists t_answers_contrib on answers;
create trigger t_answers_contrib after insert or update of is_removed or delete on answers
  for each row execute function sync_contribution_count();


-- 14g. notification on answer -----------------------------------------
create or replace function notify_post_author()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select author_id into owner from posts where id = new.post_id;
  if owner is not null and owner <> new.author_id then
    insert into notifications (user_id, kind, post_id, answer_id, actor_id)
    values (owner, 'answer_received', new.post_id, new.id, new.author_id);
  end if;
  return null;
end;
$$;

drop trigger if exists t_answers_notify on answers;
create trigger t_answers_notify after insert on answers
  for each row execute function notify_post_author();


-- 14h. message rate limit (DB-level, not just client) ------------------
create or replace function rate_limit_messages()
returns trigger language plpgsql security definer set search_path = public as $$
declare recent integer;
begin
  select count(*) into recent from messages
  where author_id = new.author_id and created_at > now() - interval '10 seconds';
  if recent >= 5 then
    raise exception 'RATE_LIMIT: slow down' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists t_messages_ratelimit on messages;
create trigger t_messages_ratelimit before insert on messages
  for each row execute function rate_limit_messages();


-- 14i. post rate limit -------------------------------------------------
create or replace function rate_limit_posts()
returns trigger language plpgsql security definer set search_path = public as $$
declare recent integer;
begin
  select count(*) into recent from posts
  where author_id = new.author_id and created_at > now() - interval '60 seconds';
  if recent >= 3 then
    raise exception 'RATE_LIMIT: slow down' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists t_posts_ratelimit on posts;
create trigger t_posts_ratelimit before insert on posts
  for each row execute function rate_limit_posts();


-- =====================================================================
-- 15. ROW LEVEL SECURITY
-- =====================================================================

alter table profiles      enable row level security;
alter table posts         enable row level security;
alter table answers       enable row level security;
alter table votes         enable row level security;
alter table listings      enable row level security;
alter table vouches       enable row level security;
alter table rooms         enable row level security;
alter table messages      enable row level security;
alter table reports       enable row level security;
alter table notifications enable row level security;

-- PROFILES -------------------------------------------------------------
drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles
  for select using (true);
drop policy if exists profiles_insert_self on profiles;
create policy profiles_insert_self on profiles
  for insert with check (auth.uid() = id);
drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles
  for update using (auth.uid() = id and not is_banned)
  with check (auth.uid() = id);
drop policy if exists profiles_update_staff on profiles;
create policy profiles_update_staff on profiles
  for update using (is_staff());

-- POSTS ----------------------------------------------------------------
drop policy if exists posts_read on posts;
create policy posts_read on posts
  for select using (not is_removed or is_staff());
drop policy if exists posts_insert on posts;
create policy posts_insert on posts
  for insert with check (auth.uid() = author_id and is_active_user());
drop policy if exists posts_update_own on posts;
create policy posts_update_own on posts
  for update using (auth.uid() = author_id and not is_removed)
  with check (auth.uid() = author_id);
drop policy if exists posts_update_staff on posts;
create policy posts_update_staff on posts
  for update using (is_staff());

-- ANSWERS --------------------------------------------------------------
drop policy if exists answers_read on answers;
create policy answers_read on answers
  for select using (not is_removed or is_staff());
drop policy if exists answers_insert on answers;
create policy answers_insert on answers
  for insert with check (auth.uid() = author_id and is_active_user());
drop policy if exists answers_update_own on answers;
create policy answers_update_own on answers
  for update using (auth.uid() = author_id and not is_removed)
  with check (auth.uid() = author_id);
drop policy if exists answers_update_staff on answers;
create policy answers_update_staff on answers
  for update using (is_staff());

-- VOTES ----------------------------------------------------------------
drop policy if exists votes_read on votes;
create policy votes_read on votes
  for select using (true);
drop policy if exists votes_insert on votes;
create policy votes_insert on votes
  for insert with check (auth.uid() = voter_id and is_active_user());
drop policy if exists votes_delete_own on votes;
create policy votes_delete_own on votes
  for delete using (auth.uid() = voter_id);

-- LISTINGS -------------------------------------------------------------
drop policy if exists listings_read on listings;
create policy listings_read on listings
  for select using (not is_removed or is_staff());
drop policy if exists listings_insert on listings;
create policy listings_insert on listings
  for insert with check (auth.uid() = submitted_by and is_active_user());
drop policy if exists listings_update_own on listings;
create policy listings_update_own on listings
  for update using (auth.uid() in (submitted_by, claimed_by) and not is_removed);
drop policy if exists listings_update_staff on listings;
create policy listings_update_staff on listings
  for update using (is_staff());

-- VOUCHES --------------------------------------------------------------
drop policy if exists vouches_read on vouches;
create policy vouches_read on vouches
  for select using (true);
drop policy if exists vouches_insert on vouches;
create policy vouches_insert on vouches
  for insert with check (auth.uid() = voucher_id and is_active_user());
drop policy if exists vouches_delete_own on vouches;
create policy vouches_delete_own on vouches
  for delete using (auth.uid() = voucher_id);

-- ROOMS ----------------------------------------------------------------
drop policy if exists rooms_read on rooms;
create policy rooms_read on rooms
  for select using (true);
drop policy if exists rooms_write_staff on rooms;
create policy rooms_write_staff on rooms
  for all using (is_staff()) with check (is_staff());

-- MESSAGES -------------------------------------------------------------
drop policy if exists messages_read on messages;
create policy messages_read on messages
  for select using (not is_removed or is_staff());
drop policy if exists messages_insert on messages;
create policy messages_insert on messages
  for insert with check (
    auth.uid() = author_id
    and is_active_user()
    and exists (select 1 from rooms r where r.id = room_id and r.is_open and not r.is_archived)
  );
drop policy if exists messages_update_staff on messages;
create policy messages_update_staff on messages
  for update using (is_staff());

-- REPORTS --------------------------------------------------------------
drop policy if exists reports_insert on reports;
create policy reports_insert on reports
  for insert with check (auth.uid() = reporter_id and is_active_user());
drop policy if exists reports_read_staff on reports;
create policy reports_read_staff on reports
  for select using (is_staff() or auth.uid() = reporter_id);
drop policy if exists reports_update_staff on reports;
create policy reports_update_staff on reports
  for update using (is_staff());

-- NOTIFICATIONS --------------------------------------------------------
drop policy if exists notifications_read_own on notifications;
create policy notifications_read_own on notifications
  for select using (auth.uid() = user_id);
drop policy if exists notifications_update_own on notifications;
create policy notifications_update_own on notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- =====================================================================
-- 15b. COLUMN-LEVEL GRANTS
--
--   CRITICAL. RLS is ROW-level only. A policy of the form
--     "for update using (auth.uid() = id)"
--   permits the user to write EVERY column of that row, including
--   role, helpful_count, is_banned. Without the grants below, any
--   client holding the public anon key can promote itself to admin.
--
--   Privileged writes (moderation, role changes, bans) are therefore
--   routed through SECURITY DEFINER functions in 15c instead.
-- =====================================================================

revoke all on profiles, posts, answers, votes, listings, vouches,
              rooms, messages, reports, notifications
  from anon, authenticated;

-- Reads. RLS still filters which ROWS come back; this filters COLUMNS.
-- date_of_birth / is_minor / is_banned / city are deliberately excluded:
-- consume them through the public_profiles view below.
grant select (id, display_name, country_flag, role,
              contribution_count, helpful_count, created_at)
  on profiles to anon, authenticated;

grant select on posts, answers, votes, listings, vouches,
                rooms, messages to anon, authenticated;
grant select on reports, notifications to authenticated;

-- Writes: only the fields a user legitimately authors.
grant insert (id, display_name, city, country_flag, date_of_birth)
  on profiles to authenticated;
grant update (display_name, city, country_flag, show_city)
  on profiles to authenticated;

grant insert (author_id, type, title, body, city, is_anonymous)
  on posts to authenticated;
grant update (title, body, city, is_anonymous)
  on posts to authenticated;

grant insert (post_id, author_id, body, is_anonymous)
  on answers to authenticated;
grant update (body, is_anonymous)
  on answers to authenticated;

grant insert (voter_id, target_type, target_id) on votes to authenticated;
grant delete on votes to authenticated;

grant insert (submitted_by, name, service_tag, city, description,
              contact_phone, contact_email, search_aliases)
  on listings to authenticated;
grant update (name, service_tag, city, description,
              contact_phone, contact_email, search_aliases)
  on listings to authenticated;

grant insert (listing_id, voucher_id, note) on vouches to authenticated;
grant delete on vouches to authenticated;

grant insert (room_id, author_id, body, image_url) on messages to authenticated;

grant insert (reporter_id, target_type, target_id, reason)
  on reports to authenticated;

grant update (is_read) on notifications to authenticated;

-- rooms are managed by you via the dashboard / service_role. Read-only here.


-- =====================================================================
-- 15c. PUBLIC PROFILE VIEW
--   Runs as owner, so it bypasses the column grants above and can
--   mask city for under-18 accounts. Join to THIS, not to profiles.
-- =====================================================================

create or replace view public_profiles
with (security_invoker = false) as
  select p.id,
         p.display_name,
         p.country_flag,
         p.role,
         p.contribution_count,
         p.helpful_count,
         p.created_at,
         case
           when p.id = auth.uid() then p.city          -- always see your own
           when p.is_minor then null                    -- never expose a minor's city
           when not p.show_city then null
           else p.city
         end as city,
         (p.id = auth.uid()) as is_self
  from profiles p
  where not p.is_banned or p.id = auth.uid();

grant select on public_profiles to anon, authenticated;


-- =====================================================================
-- 15d. PRIVILEGED WRITES (moderation / admin)
--   The only path to is_removed, is_banned, role, report status.
-- =====================================================================

create or replace function mod_remove(p_target report_target, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if    p_target = 'post'    then update posts    set is_removed = true, removed_by = auth.uid() where id = p_id;
  elsif p_target = 'answer'  then update answers  set is_removed = true, removed_by = auth.uid() where id = p_id;
  elsif p_target = 'message' then update messages set is_removed = true, removed_by = auth.uid() where id = p_id;
  elsif p_target = 'listing' then update listings set is_removed = true, removed_by = auth.uid() where id = p_id;
  else  raise exception 'UNSUPPORTED_TARGET' using errcode = 'P0001';
  end if;
end $$;

create or replace function mod_restore(p_target report_target, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if    p_target = 'post'    then update posts    set is_removed = false, removed_by = null where id = p_id;
  elsif p_target = 'answer'  then update answers  set is_removed = false, removed_by = null where id = p_id;
  elsif p_target = 'message' then update messages set is_removed = false, removed_by = null where id = p_id;
  elsif p_target = 'listing' then update listings set is_removed = false, removed_by = null where id = p_id;
  else  raise exception 'UNSUPPORTED_TARGET' using errcode = 'P0001';
  end if;
end $$;

create or replace function mod_set_ban(p_user uuid, p_banned boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if exists (select 1 from profiles where id = p_user and role = 'admin') then
    raise exception 'CANNOT_BAN_ADMIN' using errcode = 'P0001';
  end if;
  update profiles set is_banned = p_banned where id = p_user;
end $$;

create or replace function mod_resolve_report(p_report uuid, p_status report_status)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  update reports set status = p_status, handled_by = auth.uid(), handled_at = now()
  where id = p_report;
end $$;

create or replace function admin_set_role(p_user uuid, p_role user_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  update profiles set role = p_role where id = p_user;
end $$;

-- Promote your own account once, from the SQL editor:
--   update profiles set role = 'admin' where id = '<your-uuid>';


-- =====================================================================
-- 16. UNIFIED SEARCH
--     Listings always rank above posts. City filter optional.
-- =====================================================================

create or replace function search_all(q text, filter_city text default null)
returns table (
  result_kind text,
  id          uuid,
  title       text,
  subtitle    text,
  city        text,
  metric      integer,
  created_at  timestamptz,
  rank        real
)
language sql stable as $$
  with tsq as (select websearch_to_tsquery('simple', q) as query)
  select 'listing'::text                              as result_kind,
         l.id                                         as id,
         l.name                                       as title,
         l.service_tag                                as subtitle,
         l.city                                       as city,
         l.vouch_count                                as metric,
         l.created_at                                 as created_at,
         (ts_rank(l.search_tsv, tsq.query) + 1.0)::real as rank
         -- +1 keeps listings ranked above posts
  from listings l, tsq
  where not l.is_removed
    and char_length(trim(coalesce(q,''))) > 0
    and (l.search_tsv @@ tsq.query or l.name ilike '%' || q || '%')
    and (filter_city is null or l.city = filter_city)

  union all

  select 'post'::text,
         p.id,
         p.title,
         p.type::text,
         p.city,
         p.answer_count,
         p.created_at,
         ts_rank(p.search_tsv, tsq.query)::real
  from posts p, tsq
  where not p.is_removed
    and char_length(trim(coalesce(q,''))) > 0
    and p.search_tsv @@ tsq.query
    and (filter_city is null or p.city = filter_city)

  -- ordinal positions: ORDER BY cannot reference branch aliases across a UNION
  order by 8 desc, 7 desc
  limit 50;
$$;


-- =====================================================================
-- 17. SEED ROOMS
-- =====================================================================

insert into rooms (slug, name, type, sort_order) values
  ('general', 'General',  'general', 0),
  ('football','Football', 'general', 1)
on conflict (slug) do nothing;


-- =====================================================================
-- 18. REALTIME
-- =====================================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table messages; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table notifications; exception when duplicate_object then null; end;
  end if;
end $$;

commit;

-- =====================================================================
-- END
-- =====================================================================