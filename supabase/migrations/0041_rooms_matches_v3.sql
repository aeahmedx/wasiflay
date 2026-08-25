-- =====================================================================
-- WASIF LAY — 0041: rooms and matches, properly joined
--
-- 0037 was one transaction and its backfill loop failed, so the whole
-- file rolled back — including the parts that had nothing to do with
-- the failure. 0038 fixed the loop but never re-applied the rest, so
-- for the last few migrations:
--
--   * create_match has not been opening a room
--   * update_match has not been renaming one
--   * room_match and next_match_after do not exist at all
--
-- That is why a new match arrived with no room, and why a closed room's
-- "next fixture" link was always empty.
--
-- Two further problems this fixes:
--
--   Deleting a match left its room behind. The room is type 'match'
--   with no match to point at, so room_chat_state returned 'closed' —
--   and closed rooms stay on the list. They never went away.
--
--   Cancelling a match did the same thing.
--
-- An orphaned match room is now 'expired' rather than 'closed', so it
-- leaves on its own even if something else is missed. That is the belt
-- to the braces of deleting it outright.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Creating a match opens its room
-- ---------------------------------------------------------------------
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

  perform ensure_match_room(new_id);

  return new_id;
end $$;

grant execute on function create_match(text, text, timestamptz, match_round)
  to authenticated;

-- ---------------------------------------------------------------------
-- 2. Editing a match renames its room
-- ---------------------------------------------------------------------
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

  -- A room called "Michigan v Philadelpia" after the typo is corrected
  -- is worse than no room name at all.
  if v_room is not null then
    update rooms
       set name = trim(p_home) || ' v ' || trim(p_away),
           sort_order = (extract(epoch from p_kickoff) / 60)::integer
     where id = v_room;
  end if;
end $$;

grant execute on function update_match(uuid, text, text, timestamptz, match_round)
  to authenticated;

-- ---------------------------------------------------------------------
-- 2b. Opening a room, with collisions handled
--
-- The slug is built from the team names and the date, so two fixtures
-- between the same teams on the same day produced the same slug — and
-- the second match silently adopted the first one's room. Both then
-- pointed at it, and room_match returned whichever came back first.
--
-- Rare, but a group stage and a replay on one day is not impossible,
-- and the failure is confusing rather than loud. A reused slug is only
-- adopted when no other match already holds it.
-- ---------------------------------------------------------------------
create or replace function ensure_match_room(p_match uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  m       matches%rowtype;
  v_slug  text;
  v_base  text;
  v_room  uuid;
  v_taken boolean;
  v_n     integer := 1;
begin
  select * into m from matches where id = p_match;
  if m.id is null then
    raise exception 'MATCH_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Already has one: make sure it's usable and hand it back.
  if m.room_id is not null then
    update rooms set is_open = true, is_archived = false where id = m.room_id;
    return m.room_id;
  end if;

  v_base := match_room_slug(m);
  v_slug := v_base;

  loop
    select id into v_room from rooms where rooms.slug = v_slug;

    exit when v_room is null;

    -- The slug exists. Free to reuse only if no other match holds it.
    select exists (
      select 1 from matches k
       where k.room_id = v_room and k.id <> p_match
    ) into v_taken;

    exit when not v_taken;

    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
    v_room := null;
  end loop;

  if v_room is null then
    insert into rooms (slug, name, type, sort_order, is_open)
    values (
      v_slug,
      m.home_team || ' v ' || m.away_team,
      'match',
      -- Sorted by kickoff so today's matches sit above older ones.
      (extract(epoch from m.kicks_off_at) / 60)::integer,
      true
    )
    returning id into v_room;
  else
    update rooms set is_open = true, is_archived = false where id = v_room;
  end if;

  update matches set room_id = v_room where id = p_match;
  return v_room;
end $$;

revoke all on function ensure_match_room(uuid) from anon, authenticated;

/**
 * The guarded entry point. The work above is unguarded so migrations
 * and triggers can call it — a maintenance task has no auth.uid(), and
 * a backfill that refuses to run because nobody is logged in is a
 * backfill that never runs.
 */
create or replace function open_match_room(p_match uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
begin
  if not is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  return ensure_match_room(p_match);
end $$;

grant execute on function open_match_room(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Lookups the room page needs
-- ---------------------------------------------------------------------
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
-- 4. A match room with no match is expired, not closed
--
-- 'closed' keeps a room on the list, which is right for the hour after
-- full time and wrong forever. A room whose match was deleted or
-- cancelled has nothing left to say.
-- ---------------------------------------------------------------------
create or replace function room_chat_state(p_room uuid)
returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  r rooms%rowtype;
  m matches%rowtype;
begin
  select * into r from rooms where id = p_room;
  if r.id is null then
    return 'closed';
  end if;

  if r.type <> 'match' then
    return case when r.is_open and not r.is_archived then 'open' else 'closed' end;
  end if;

  select * into m from matches
   where room_id = p_room and status <> 'cancelled'
   limit 1;

  -- Orphaned: the match was deleted or cancelled underneath it.
  if m.id is null then
    return 'expired';
  end if;

  if m.status = 'finished' then
    if coalesce(m.finished_at, m.updated_at) + match_room_grace() > now() then
      return 'closed';
    end if;
    return 'expired';
  end if;

  if now() < m.kicks_off_at then
    return 'waiting';
  end if;

  return 'open';
end $$;

grant execute on function room_chat_state(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Deleting a match takes its room with it
-- ---------------------------------------------------------------------
create or replace function delete_match(p_match uuid)
returns table (
  deleted_predictions integer,
  had_room             boolean
)
language plpgsql security definer set search_path = public
as $$
declare
  n_preds integer;
  v_room  uuid;
begin
  if not is_admin() then
    raise exception 'ADMIN_ONLY' using errcode = 'P0001';
  end if;

  select count(*)::integer into n_preds
    from predictions where match_id = p_match;

  select room_id into v_room from matches where id = p_match;

  -- Unlink first, so deleting the room can't cascade into the match.
  update matches set room_id = null where id = p_match;

  delete from matches where id = p_match;

  /**
   * The room goes too. Previously it was left behind, which meant a
   * deleted fixture left a permanent room named after a match that
   * never happened.
   *
   * Messages cascade with it — the conversation was about a match that
   * has been erased, and keeping it would leave a room nobody can
   * reach through anything.
   */
  if v_room is not null then
    delete from rooms where id = v_room;
  end if;

  return query select n_preds, v_room is not null;
end $$;

grant execute on function delete_match(uuid) to authenticated;

/**
 * Cancelling keeps the record but the room has nothing to host, so it
 * goes the same way. Cancel is the softer action on the match, not on
 * the room.
 */
create or replace function cancel_match(p_match uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_room uuid;
begin
  if not is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select room_id into v_room from matches where id = p_match;

  update matches set status = 'cancelled', room_id = null where id = p_match;

  if v_room is not null then
    delete from rooms where id = v_room;
  end if;
end $$;

grant execute on function cancel_match(uuid) to authenticated;

commit;

-- ---------------------------------------------------------------------
-- 6. Repair what the rollback left behind.
--
-- Outside the transaction above so a failure here can't undo the fixes,
-- which is exactly how 0037 lost everything.
-- ---------------------------------------------------------------------

-- Matches with no room get one.
do $backfill$
declare r matches%rowtype;
begin
  for r in
    select * from matches
    where room_id is null and status <> 'cancelled'
  loop
    -- Reuses open_match_room rather than repeating its logic, so the
    -- collision handling above applies here too.
    perform ensure_match_room(r.id);
  end loop;
end $backfill$;

-- Match rooms with no match get removed.
do $orphans$
begin
  delete from rooms r
   where r.type = 'match'
     and not exists (
       select 1 from matches m
        where m.room_id = r.id and m.status <> 'cancelled'
     );
end $orphans$;

-- Check:
--   select m.home_team, m.away_team, m.status, r.slug,
--          room_chat_state(r.id) as state
--     from matches m left join rooms r on r.id = m.room_id
--    order by m.kicks_off_at;
--
--   select count(*) as orphan_rooms from rooms r
--    where r.type = 'match'
--      and not exists (select 1 from matches m where m.room_id = r.id);
