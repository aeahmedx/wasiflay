-- =====================================================================
-- WASIF LAY — 0037: a room per match, from creation
--
-- Rooms used to open when a match was locked. Creating one at the same
-- time as the match means it exists for a fixture that may be days
-- away, and an empty room reads as a dead app.
--
-- What makes that work is the countdown: a room with "kicks off in 2h"
-- at the top has a reason to be quiet. Without it this change would be
-- a downgrade, so the two ship together.
--
-- The lifecycle:
--
--   created   room opens with the match, countdown to kickoff
--   kickoff   countdown becomes "playing now"
--   result    room closes to new messages, points to the next fixture
--
-- Closed means read-only, never deleted. The conversation is worth
-- keeping — it's the record of the match.
-- =====================================================================

begin;

/**
 * Creating a match opens its room in the same action. One less thing to
 * remember, and it means a fixture is never announced without somewhere
 * to talk about it.
 */
create or replace function create_match(
  p_home    text,
  p_away    text,
  p_kickoff timestamptz,
  p_round   match_round default 'group'
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare new_id uuid;
begin
  if not is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  insert into matches (home_team, away_team, kicks_off_at, round, created_by)
  values (trim(p_home), trim(p_away), p_kickoff, p_round, auth.uid())
  returning id into new_id;

  perform open_match_room(new_id);

  return new_id;
end $$;

grant execute on function create_match(text, text, timestamptz, match_round)
  to authenticated;

/**
 * Editing a match renames its room, so a corrected team name or a moved
 * kickoff doesn't leave a room called something that no longer exists.
 */
create or replace function update_match(
  p_match   uuid,
  p_home    text,
  p_away    text,
  p_kickoff timestamptz,
  p_round   match_round
)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_room uuid;
begin
  if not is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  update matches
     set home_team = trim(p_home),
         away_team = trim(p_away),
         kicks_off_at = p_kickoff,
         round = p_round
   where id = p_match
   returning room_id into v_room;

  if v_room is not null then
    update rooms
       set name = trim(p_home) || ' v ' || trim(p_away),
           sort_order = (extract(epoch from p_kickoff) / 60)::integer
     where id = v_room;
  end if;
end $$;

grant execute on function update_match(uuid, text, text, timestamptz, match_round)
  to authenticated;

/**
 * The match a room belongs to, if any.
 *
 * The room page needs the kickoff for its countdown and the score for
 * its closing line, and it only has a room id to work from.
 */
create or replace function room_match(p_room uuid)
returns table (
  id           uuid,
  home_team    text,
  away_team    text,
  kicks_off_at timestamptz,
  status       match_status,
  home_score   integer,
  away_score   integer,
  locked_at    timestamptz
)
language sql stable security definer set search_path = public
as $$
  select m.id, m.home_team, m.away_team, m.kicks_off_at, m.status,
         m.home_score, m.away_score, m.locked_at
  from matches m
  where m.room_id = p_room and m.status <> 'cancelled'
  limit 1;
$$;

grant execute on function room_match(uuid) to anon, authenticated;

/**
 * The next fixture, for a closed room to point at. Somewhere to go is
 * better than a dead end — the whole reason the room closes rather than
 * disappearing.
 */
create or replace function next_match_after(p_match uuid)
returns table (
  id           uuid,
  home_team    text,
  away_team    text,
  kicks_off_at timestamptz,
  room_slug    text
)
language sql stable security definer set search_path = public
as $$
  select m.id, m.home_team, m.away_team, m.kicks_off_at, r.slug
  from matches m
  left join rooms r on r.id = m.room_id
  where m.status <> 'cancelled'
    and m.status <> 'finished'
    and m.kicks_off_at > coalesce(
      (select k.kicks_off_at from matches k where k.id = p_match),
      now()
    )
  order by m.kicks_off_at
  limit 1;
$$;

grant execute on function next_match_after(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Backfill: matches created before this migration have no room.
-- ---------------------------------------------------------------------
do $backfill$
declare r record;
        v_slug text;
        v_room uuid;
begin
  for r in
    select * from matches
    where room_id is null and status <> 'cancelled'
  loop
    v_slug := match_room_slug(r);

    select id into v_room from rooms where rooms.slug = v_slug;

    if v_room is null then
      insert into rooms (slug, name, type, sort_order, is_open)
      values (
        v_slug,
        r.home_team || ' v ' || r.away_team,
        'match',
        (extract(epoch from r.kicks_off_at) / 60)::integer,
        r.status <> 'finished'
      )
      returning id into v_room;
    end if;

    update matches set room_id = v_room where id = r.id;
  end loop;
end $backfill$;

commit;
