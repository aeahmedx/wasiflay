-- =====================================================================
-- WASIF LAY — 0034: match rooms and goal bursts
--
-- Three things:
--
-- 1. Locking a match opens its room. Not when the match is created —
--    a room that exists for a game three days away is an empty room,
--    and an empty room teaches people the app is dead. Rooms appear at
--    kickoff, when there is something to talk about.
--
-- 2. Finishing a match closes its room to new messages. The
--    conversation stays readable; it just stops being live.
--
-- 3. GOAL. Deliberately NOT a crowd-sourced score.
--
--    A voted scoreline is trivially gamed by whoever is loudest, drifts
--    once people stop bothering, and ends up arguing with the official
--    result you enter yourself — in front of everyone. So this records
--    that people reacted, and claims nothing about the score. The room
--    shows "14 said GOAL" as a moment, and the real score arrives when
--    a moderator enters it. One source of truth.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1 & 2. Rooms follow the match
-- ---------------------------------------------------------------------

/** A stable, readable slug: "michigan-v-philadelphia-0906". */
create or replace function match_room_slug(p_match matches)
returns text
language sql immutable
as $$
  select left(
    regexp_replace(
      lower(p_match.home_team || '-v-' || p_match.away_team),
      '[^a-z0-9]+', '-', 'g'
    ), 40
  ) || '-' || to_char(p_match.kicks_off_at, 'MMDD');
$$;

create or replace function open_match_room(p_match uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  m    matches%rowtype;
  slug text;
  rid  uuid;
begin
  if not is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select * into m from matches where id = p_match;
  if m.id is null then
    raise exception 'MATCH_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Already has one: make sure it's open and hand it back.
  if m.room_id is not null then
    update rooms set is_open = true, is_archived = false where id = m.room_id;
    return m.room_id;
  end if;

  slug := match_room_slug(m);

  -- A re-run, or two fixtures with the same teams on the same day.
  select id into rid from rooms where rooms.slug = slug;

  if rid is null then
    insert into rooms (slug, name, type, sort_order, is_open)
    values (
      slug,
      m.home_team || ' v ' || m.away_team,
      'match',
      -- Sorted by kickoff so today's matches sit above older ones.
      (extract(epoch from m.kicks_off_at) / 60)::integer,
      true
    )
    returning id into rid;
  else
    update rooms set is_open = true, is_archived = false where id = rid;
  end if;

  update matches set room_id = rid where id = p_match;
  return rid;
end $$;

grant execute on function open_match_room(uuid) to authenticated;

/**
 * Locking opens the room in the same action. Two taps at kickoff is one
 * too many when you're standing at the side of a pitch.
 *
 * Dropped first because the return type changes: 0029 returned void,
 * this returns the room id. Postgres won't replace a function with a
 * different return type, and nothing else calls it by reference, so
 * dropping is safe.
 */
drop function if exists lock_match(uuid);

create or replace function lock_match(p_match uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare rid uuid;
begin
  if not is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  update matches
     set locked_at = now(),
         status = case when status = 'scheduled' then 'locked' else status end
   where id = p_match;

  rid := open_match_room(p_match);
  return rid;
end $$;

grant execute on function lock_match(uuid) to authenticated;

/**
 * Finishing closes the room to new messages but leaves it readable —
 * the conversation is worth keeping, it just stops being live.
 */
create or replace function close_match_room(p_match uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare rid uuid;
begin
  select room_id into rid from matches where id = p_match;
  if rid is not null then
    update rooms set is_open = false where id = rid;
  end if;
end $$;

create or replace function set_match_result(
  p_match uuid,
  p_home  integer,
  p_away  integer
)
returns integer
language plpgsql security definer set search_path = public
as $$
declare m matches%rowtype;
        scored integer;
begin
  if not is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select * into m from matches where id = p_match;
  if m.id is null then
    raise exception 'MATCH_NOT_FOUND' using errcode = 'P0001';
  end if;

  update matches
     set home_score = p_home,
         away_score = p_away,
         status = 'finished',
         locked_at = coalesce(locked_at, now())
   where id = p_match;

  with scoredp as (
    select pr.user_id,
           score_tier(pr.home_score, pr.away_score, p_home, p_away) as tier
    from predictions pr
    where pr.match_id = p_match
  )
  update predictions pr
     set tier = s.tier,
         points = (tier_points(s.tier) * round_multiplier(m.round))::integer
    from scoredp s
   where pr.match_id = p_match and pr.user_id = s.user_id;

  get diagnostics scored = row_count;

  perform close_match_room(p_match);

  return scored;
end $$;

grant execute on function set_match_result(uuid, integer, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 3. GOAL
-- ---------------------------------------------------------------------
create table if not exists goal_calls (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid        not null references rooms(id) on delete cascade,
  user_id    uuid        not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_goal_calls_room
  on goal_calls (room_id, created_at desc);

alter table goal_calls enable row level security;

drop policy if exists goal_calls_read on goal_calls;
create policy goal_calls_read on goal_calls for select using (true);

grant select on goal_calls to anon, authenticated;

/**
 * One call per person per twenty seconds. Not to stop enthusiasm — to
 * stop one person looking like a crowd, which is the only way a
 * reaction burst can lie.
 */
create or replace function call_goal(p_room uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare recent integer;
        burst  integer;
begin
  if auth.uid() is null then
    raise exception 'NOT_SIGNED_IN' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from profiles
    where id = auth.uid() and not is_banned and deleted_at is null
  ) then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;

  select count(*) into recent from goal_calls
   where room_id = p_room
     and user_id = auth.uid()
     and created_at > now() - interval '20 seconds';

  if recent > 0 then
    raise exception 'TOO_SOON' using errcode = 'P0001';
  end if;

  insert into goal_calls (room_id, user_id) values (p_room, auth.uid());

  select count(distinct user_id) into burst from goal_calls
   where room_id = p_room and created_at > now() - interval '45 seconds';

  return burst;
end $$;

grant execute on function call_goal(uuid) to authenticated;

/**
 * How many distinct people called it in the last 45 seconds. Distinct,
 * so the number means "people", not "taps" — the whole point is that it
 * reports a crowd honestly rather than claiming a score.
 */
create or replace function goal_burst(p_room uuid)
returns integer
language sql stable security definer set search_path = public
as $$
  select count(distinct user_id)::integer
  from goal_calls
  where room_id = p_room and created_at > now() - interval '45 seconds';
$$;

grant execute on function goal_burst(uuid) to anon, authenticated;

-- Bursts arrive as they happen, like messages.
do $realtime$
begin
  execute 'alter publication supabase_realtime add table goal_calls';
exception when duplicate_object then null;
end $realtime$;

commit;
