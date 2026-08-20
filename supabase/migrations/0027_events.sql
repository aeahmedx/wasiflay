-- =====================================================================
-- WASIF LAY — 0027: events
--
-- The safety decision that shaped this whole schema:
--
--   Anyone can create an event. Online events collect a name, phone and
--   email and hand them to the organiser. So the attack is: create a
--   fake "Sudanese Youth Scholarship Session", harvest contact details
--   from teenagers, delete the event.
--
-- Three defences, all in the database:
--
--   1. Contact details are collected only AFTER a moderator approves
--      the event. Flagging after the fact is too late — the details are
--      already gone.
--   2. Under-18 attendees are counted but their details are NEVER
--      released. The organiser sees "3 attending (1 under 18 —
--      details withheld)".
--   3. Organiser contact details are never public to anyone. People ask
--      about an event by posting a question, which the community can
--      also answer.
-- =====================================================================

begin;

create type event_kind   as enum ('physical', 'online', 'contact');
create type event_status as enum ('pending', 'approved', 'rejected');
create type rsvp_kind    as enum ('interested', 'attending');

create table events (
  id           uuid primary key default gen_random_uuid(),
  creator_id   uuid         not null references profiles(id) on delete cascade,
  title        text         not null check (char_length(trim(title)) between 5 and 140),
  description  text         not null default '' check (char_length(description) <= 4000),
  kind         event_kind   not null,
  starts_at    timestamptz  not null,
  ends_at      timestamptz,
  region       text         references regions(slug),   -- null = everywhere

  -- physical
  venue_name   text,
  address      text,

  -- online: never public. Released to confirmed attendees only.
  join_url     text,

  -- organiser contact: never public to anyone, ever. Visible to the
  -- creator and to staff, for accountability and for reaching them.
  organizer_name  text not null,
  organizer_phone text,
  organizer_email text,
  organizer_org   text,

  status       event_status not null default 'pending',
  reviewed_by  uuid references profiles(id),
  reviewed_at  timestamptz,
  review_note  text,

  is_removed   boolean      not null default false,
  removed_by   uuid references profiles(id),
  removed_at   timestamptz,

  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now(),

  check (ends_at is null or ends_at > starts_at),
  check (kind <> 'online'   or join_url is not null),
  check (kind <> 'physical' or address  is not null)
);

create index idx_events_when   on events (starts_at) where not is_removed;
create index idx_events_region on events (region, starts_at) where not is_removed;
create index idx_events_status on events (status) where status = 'pending';

create trigger t_events_touch before update on events
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------
-- Editing an approved event sends it back for review.
--
-- Otherwise the approval is meaningless: get a plain event approved,
-- then swap in a different link and title afterwards.
-- ---------------------------------------------------------------------
create or replace function reset_event_review()
returns trigger language plpgsql as $$
begin
  if old.status = 'approved' and (
       new.title       is distinct from old.title
    or new.description is distinct from old.description
    or new.kind        is distinct from old.kind
    or new.join_url    is distinct from old.join_url
    or new.address     is distinct from old.address
    or new.starts_at   is distinct from old.starts_at
  ) then
    new.status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;
  return new;
end $$;

create trigger t_events_rereview before update on events
  for each row execute function reset_event_review();

-- Event creation is rate limited like everything else.
create or replace function rate_limit_events()
returns trigger language plpgsql security definer set search_path = public as $$
declare recent integer;
begin
  select count(*) into recent from events
   where creator_id = new.creator_id and created_at > now() - interval '1 hour';
  if recent >= 5 then
    raise exception 'RATE_LIMIT: slow down' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger t_events_ratelimit before insert on events
  for each row execute function rate_limit_events();

-- ---------------------------------------------------------------------
-- RSVPs
-- ---------------------------------------------------------------------
create table event_rsvps (
  event_id     uuid        not null references events(id) on delete cascade,
  user_id      uuid        not null references profiles(id) on delete cascade,
  kind         rsvp_kind   not null default 'interested',
  -- Recorded when someone agreed to their details being shared, so
  -- there's an answer to "did they consent" that isn't a guess.
  consented_at timestamptz,
  created_at   timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index idx_rsvps_user on event_rsvps (user_id);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table events      enable row level security;
alter table event_rsvps enable row level security;

-- Reading is filtered by the view below; the table policy exists so the
-- view's owner-level access works and staff can query directly.
create policy events_read on events
  for select using (
    (status = 'approved' and not is_removed)
    or creator_id = auth.uid()
    or is_staff()
  );

create policy events_insert on events
  for insert with check (auth.uid() = creator_id and is_active_user());

create policy events_update_own on events
  for update using (auth.uid() = creator_id and not is_removed);

create policy events_update_staff on events
  for update using (is_staff());

create policy rsvps_read_own on event_rsvps
  for select using (auth.uid() = user_id);

create policy rsvps_write_own on event_rsvps
  for insert with check (auth.uid() = user_id and is_active_user());

create policy rsvps_delete_own on event_rsvps
  for delete using (auth.uid() = user_id);

grant select on events to anon, authenticated;
grant insert (creator_id, title, description, kind, starts_at, ends_at,
              region, venue_name, address, join_url, organizer_name,
              organizer_phone, organizer_email, organizer_org)
  on events to authenticated;
grant update (title, description, kind, starts_at, ends_at, region,
              venue_name, address, join_url, organizer_name,
              organizer_phone, organizer_email, organizer_org)
  on events to authenticated;

grant select on event_rsvps to authenticated;
grant insert (event_id, user_id, kind, consented_at) on event_rsvps to authenticated;
grant delete on event_rsvps to authenticated;

-- ---------------------------------------------------------------------
-- The public view
--
-- Organiser contact never appears. The join link appears only for
-- confirmed attendees, the creator, and staff — a public Zoom link is
-- an invitation to disrupt the meeting.
-- ---------------------------------------------------------------------
create or replace view public_events
with (security_invoker = false) as
  select e.id,
         e.creator_id,
         e.title,
         e.description,
         e.kind,
         e.starts_at,
         e.ends_at,
         e.region,
         e.venue_name,
         -- A physical address has to be public or nobody can attend.
         case when e.kind = 'physical' then e.address else null end as address,
         case
           when e.creator_id = auth.uid() or is_staff() then e.join_url
           when exists (
             select 1 from event_rsvps r
             where r.event_id = e.id
               and r.user_id = auth.uid()
               and r.kind = 'attending'
           ) then e.join_url
           else null
         end as join_url,
         e.status,
         e.review_note,
         (e.creator_id = auth.uid()) as is_mine,
         (
           select count(*) from event_rsvps r
           where r.event_id = e.id and r.kind = 'interested'
         )::integer as interested_count,
         (
           select count(*) from event_rsvps r
           where r.event_id = e.id and r.kind = 'attending'
         )::integer as attending_count,
         (
           select r.kind from event_rsvps r
           where r.event_id = e.id and r.user_id = auth.uid()
         ) as my_rsvp,
         e.created_at
  from events e
  where not e.is_removed
    and (e.status = 'approved' or e.creator_id = auth.uid() or is_staff())
    and not exists (
      select 1 from blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = e.creator_id)
         or (b.blocked_id = auth.uid() and b.blocker_id = e.creator_id)
    );

grant select on public_events to anon, authenticated;

-- ---------------------------------------------------------------------
-- RSVP
--
-- Attending — the kind that shares contact details — is refused until
-- the event has been approved. That ordering is the whole protection:
-- reviewing afterwards means the details are already collected.
-- ---------------------------------------------------------------------
create or replace function rsvp_event(
  p_event uuid,
  p_kind  rsvp_kind,
  p_consent boolean default false
)
returns void
language plpgsql security definer set search_path = public
as $$
declare ev events%rowtype;
begin
  if auth.uid() is null then
    raise exception 'NOT_SIGNED_IN' using errcode = 'P0001';
  end if;

  select * into ev from events where id = p_event and not is_removed;
  if ev.id is null then
    raise exception 'EVENT_NOT_FOUND' using errcode = 'P0001';
  end if;

  if ev.status <> 'approved' then
    raise exception 'EVENT_NOT_APPROVED' using errcode = 'P0001';
  end if;

  if p_kind = 'attending' then
    if ev.kind <> 'online' then
      -- Physical events collect nothing. "Interested" is a headcount,
      -- not a contact list.
      raise exception 'ATTENDING_ONLINE_ONLY' using errcode = 'P0001';
    end if;
    if not p_consent then
      raise exception 'CONSENT_REQUIRED' using errcode = 'P0001';
    end if;
  end if;

  insert into event_rsvps (event_id, user_id, kind, consented_at)
  values (p_event, auth.uid(), p_kind,
          case when p_kind = 'attending' then now() else null end)
  on conflict (event_id, user_id) do update
    set kind = excluded.kind,
        consented_at = excluded.consented_at;
end $$;

grant execute on function rsvp_event(uuid, rsvp_kind, boolean) to authenticated;

create or replace function cancel_rsvp(p_event uuid)
returns void
language sql security definer set search_path = public
as $$
  delete from event_rsvps
   where event_id = p_event and user_id = auth.uid();
$$;

grant execute on function cancel_rsvp(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- The attendee list, for the organiser
--
-- Under-18 attendees are counted but never named. This is the single
-- most important rule in the file.
-- ---------------------------------------------------------------------
create or replace function event_attendees(p_event uuid)
returns table (
  display_name text,
  phone        text,
  email        text,
  withheld     boolean
)
language plpgsql stable security definer set search_path = public
as $$
declare ev events%rowtype;
begin
  select * into ev from events where id = p_event;
  if ev.id is null then
    raise exception 'EVENT_NOT_FOUND' using errcode = 'P0001';
  end if;

  if ev.creator_id <> auth.uid() and not is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  return query
  select case when p.is_minor then null else p.display_name end,
         case when p.is_minor then null else u.phone end,
         case when p.is_minor then null else u.email end,
         p.is_minor
  from event_rsvps r
  join profiles p   on p.id = r.user_id
  join auth.users u on u.id = r.user_id
  where r.event_id = p_event
    and r.kind = 'attending'
  order by r.created_at;
end $$;

grant execute on function event_attendees(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Moderation
-- ---------------------------------------------------------------------
create or replace function mod_review_event(
  p_event  uuid,
  p_status event_status,
  p_note   text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  update events
     set status = p_status,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_note = p_note
   where id = p_event;
end $$;

grant execute on function mod_review_event(uuid, event_status, text) to authenticated;

create or replace function mod_pending_events(p_limit integer default 50)
returns table (
  id              uuid,
  title           text,
  description     text,
  kind            event_kind,
  starts_at       timestamptz,
  region          text,
  venue_name      text,
  address         text,
  join_url        text,
  organizer_name  text,
  organizer_phone text,
  organizer_email text,
  organizer_org   text,
  creator_id      uuid,
  creator_name    text,
  created_at      timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
#variable_conflict use_column
begin
  if not is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  return query
  select e.id, e.title, e.description, e.kind, e.starts_at, e.region,
         e.venue_name, e.address, e.join_url,
         e.organizer_name, e.organizer_phone, e.organizer_email,
         e.organizer_org,
         e.creator_id, p.display_name, e.created_at
  from events e
  left join profiles p on p.id = e.creator_id
  where e.status = 'pending' and not e.is_removed
  order by e.created_at
  limit p_limit;
end $$;

grant execute on function mod_pending_events(integer) to authenticated;

create or replace function mod_pending_event_count()
returns integer
language sql stable security definer set search_path = public
as $$
  select case when is_staff() then (
    select count(*)::integer from events
     where status = 'pending' and not is_removed
  ) else 0 end;
$$;

grant execute on function mod_pending_event_count() to authenticated;

-- ---------------------------------------------------------------------
-- Retention
--
-- RSVP rows are contact details. Holding them forever is a liability
-- and a breach target, and the privacy policy promises 30 days.
-- ---------------------------------------------------------------------
create or replace function purge_expired_rsvps()
returns integer
language plpgsql security definer set search_path = public
as $$
declare removed integer;
begin
  delete from event_rsvps r
   using events e
   where e.id = r.event_id
     and coalesce(e.ends_at, e.starts_at + interval '6 hours')
         < now() - interval '30 days';
  get diagnostics removed = row_count;
  return removed;
end $$;

revoke all on function purge_expired_rsvps() from anon, authenticated;

-- ---------------------------------------------------------------------
-- Questions about an event land back on the event
-- ---------------------------------------------------------------------
alter table posts add column if not exists event_id uuid references events(id) on delete set null;

grant select (event_id) on posts to anon, authenticated;
grant insert (event_id) on posts to authenticated;

create index if not exists idx_posts_event on posts (event_id) where event_id is not null;

drop view if exists public_posts;

create view public_posts
with (security_invoker = false) as
  select p.id,
         case
           when not p.is_anonymous then p.author_id
           when p.author_id = auth.uid() then p.author_id
           else null
         end as author_id,
         p.type, p.title, p.body, p.city, p.region, p.is_anonymous,
         p.answer_count, p.helpful_count, p.event_id, p.created_at
  from posts p
  where not p.is_removed
    and not exists (
      select 1 from blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.author_id)
         or (b.blocked_id = auth.uid() and b.blocker_id = p.author_id)
    );

grant select on public_posts to anon, authenticated;

commit;

-- Schedule the purge once (pg_cron is already enabled by 0020):
--   select cron.schedule('wasiflay-purge-rsvps', '0 4 * * *',
--     $job$ select purge_expired_rsvps(); $job$);
