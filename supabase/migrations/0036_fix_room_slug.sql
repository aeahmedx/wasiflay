-- =====================================================================
-- WASIF LAY — 0036: fix open_match_room
--
-- The local variable was called `slug` and so is the column, so
--
--     select id from rooms where rooms.slug = slug
--
-- compared the column to itself — every row matched, and Postgres
-- refused it as ambiguous rather than guessing. Qualifying the left
-- side doesn't help; it's the right side that's undecidable.
--
-- Renamed to v_slug. The prefix is worth keeping as a habit in any
-- function that touches a table with the same column names.
-- =====================================================================

begin;

create or replace function open_match_room(p_match uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  m       matches%rowtype;
  v_slug  text;
  v_room  uuid;
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

  v_slug := match_room_slug(m);

  -- A re-run, or two fixtures with the same teams on the same day.
  select id into v_room from rooms where rooms.slug = v_slug;

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

grant execute on function open_match_room(uuid) to authenticated;

commit;

-- Check it, as yourself rather than as postgres — is_staff() reads
-- auth.uid(), which is null in the SQL editor:
--
--   select set_config(
--     'request.jwt.claims',
--     json_build_object('sub', (select id from profiles where role = 'admin' limit 1))::text,
--     true
--   );
--   select lock_match((select id from matches where status = 'scheduled' limit 1));
--
-- Both statements have to run together — the setting is
-- transaction-scoped.
