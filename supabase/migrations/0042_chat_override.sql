-- =====================================================================
-- WASIF LAY — 0042: pausing and resuming a match room
--
-- Chat opens at kickoff and closes when a result lands, both computed
-- from the match. That's right almost always — and useless in the one
-- case that matters, which is a moderator standing there watching
-- something go wrong.
--
-- So an override: pause a room that's meant to be open, or open one
-- early. Null means "follow the match", which is the default and stays
-- the default — this is a contingency, not the mechanism.
--
-- Deliberately on the room rather than the match. The match is a
-- fixture; whether people can talk is a property of the conversation.
-- =====================================================================

begin;

alter table rooms
  add column if not exists chat_override text
    check (chat_override in ('open', 'closed'));

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

  -- A moderator's hand beats the clock, in both directions.
  if r.chat_override = 'closed' then
    return 'closed';
  end if;

  if r.type <> 'match' then
    if r.chat_override = 'open' then
      return 'open';
    end if;
    return case when r.is_open and not r.is_archived then 'open' else 'closed' end;
  end if;

  select * into m from matches
   where room_id = p_room and status <> 'cancelled'
   limit 1;

  -- Orphaned: the match was deleted or cancelled underneath it.
  if m.id is null then
    return 'expired';
  end if;

  -- Opened early on purpose — but a finished match still closes, so an
  -- override can't reopen a conversation about a settled result.
  if r.chat_override = 'open' and m.status <> 'finished' then
    return 'open';
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

/**
 * Set or clear the override for a match's room.
 *
 * p_state null hands control back to the clock, which is how a
 * moderator undoes themselves without having to work out what the
 * automatic answer would have been.
 */
create or replace function set_room_chat(p_match uuid, p_state text)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_room uuid;
begin
  if not is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if p_state is not null and p_state not in ('open', 'closed') then
    raise exception 'BAD_STATE' using errcode = 'P0001';
  end if;

  select room_id into v_room from matches where id = p_match;
  if v_room is null then
    raise exception 'NO_ROOM' using errcode = 'P0001';
  end if;

  update rooms set chat_override = p_state where id = v_room;

  -- The new state, so the caller can say what actually happened rather
  -- than what it asked for.
  return room_chat_state(v_room);
end $$;

grant execute on function set_room_chat(uuid, text) to authenticated;

-- The staff match list carries the override, so the control can show
-- which way it's currently set.
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
  prediction_count integer,
  chat_state       text,
  chat_override    text
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
         (select count(*) from predictions pr where pr.match_id = m.id)::integer,
         case when r.id is null then null else room_chat_state(r.id) end,
         r.chat_override
  from matches m
  left join rooms r on r.id = m.room_id
  where m.status <> 'cancelled'
  order by m.kicks_off_at
  limit p_limit;
end $$;

grant execute on function staff_match_list(integer) to authenticated;

commit;
