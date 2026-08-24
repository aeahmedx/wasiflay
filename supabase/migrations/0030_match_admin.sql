-- =====================================================================
-- WASIF LAY — 0030: match management
--
-- 0029 granted select on matches but no insert or update, so the staff
-- write policy had nothing to permit — RLS decides which rows you may
-- touch, grants decide whether you may touch the table at all, and both
-- have to agree.
--
-- Closing it with RPCs rather than table grants, for the same reason
-- moderation works that way: the privilege lives in one auditable
-- function instead of being spread across column grants that have to be
-- kept in step.
-- =====================================================================

begin;

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

  return new_id;
end $$;

grant execute on function create_match(text, text, timestamptz, match_round)
  to authenticated;

/**
 * Kickoff times move constantly at community tournaments. Editing one
 * deliberately does NOT touch predictions already made — someone who
 * picked in good faith keeps their pick.
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
begin
  if not is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  update matches
     set home_team = trim(p_home),
         away_team = trim(p_away),
         kicks_off_at = p_kickoff,
         round = p_round
   where id = p_match;
end $$;

grant execute on function update_match(uuid, text, text, timestamptz, match_round)
  to authenticated;

/**
 * Cancelled rather than deleted. A match people already predicted on
 * shouldn't vanish along with their picks — public_matches filters
 * cancelled out, so it disappears from view while the record survives.
 */
create or replace function cancel_match(p_match uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  update matches set status = 'cancelled' where id = p_match;
end $$;

grant execute on function cancel_match(uuid) to authenticated;

/**
 * Attach a room to a match. Rooms are opened only for the matches that
 * matter — a room with two people in it is worse than no room, and it
 * teaches people the app is dead.
 */
create or replace function set_match_room(p_match uuid, p_room uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  update matches set room_id = p_room where id = p_match;
end $$;

grant execute on function set_match_room(uuid, uuid) to authenticated;

/**
 * Correcting a result after the fact. Rescoring is just set_match_result
 * again — it overwrites every prediction's points rather than adding to
 * them, so a fat-fingered score can be fixed without anyone keeping
 * points they didn't earn.
 */
create or replace function staff_match_list(p_limit integer default 100)
returns table (
  id               uuid,
  home_team        text,
  away_team        text,
  kicks_off_at     timestamptz,
  round            match_round,
  status           match_status,
  home_score       integer,
  away_score       integer,
  locked_at        timestamptz,
  room_id          uuid,
  room_slug        text,
  prediction_count integer
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  return query
  select m.id, m.home_team, m.away_team, m.kicks_off_at, m.round,
         m.status, m.home_score, m.away_score, m.locked_at,
         m.room_id, r.slug,
         (select count(*) from predictions pr where pr.match_id = m.id)::integer
  from matches m
  left join rooms r on r.id = m.room_id
  where m.status <> 'cancelled'
  order by m.kicks_off_at
  limit p_limit;
end $$;

grant execute on function staff_match_list(integer) to authenticated;

commit;
