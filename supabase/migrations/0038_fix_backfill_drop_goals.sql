-- =====================================================================
-- WASIF LAY — 0038: fix the room backfill, and simplify GOAL
--
-- Two things.
--
-- 1. The backfill loop in 0037 failed. `for r in select * from matches`
--    yields an untyped record, and match_room_slug(r) takes a `matches`
--    row — Postgres won't cast one to the other. Declaring the loop
--    variable as matches%rowtype fixes it.
--
-- 2. GOAL becomes a message instead of a counter.
--
--    A live count needed a time window, a rate limit, and a rule for
--    what the number meant — three things to tune, and a number that
--    could be wrong in front of everyone. Sending a message instead
--    inherits moderation, blocking, rate limiting, realtime delivery
--    and the offline queue, all of which already work. Nothing new to
--    get right, and it can't lie because it isn't claiming anything.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Backfill, properly typed
-- ---------------------------------------------------------------------
do $backfill$
declare
  r      matches%rowtype;
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

-- ---------------------------------------------------------------------
-- 2. GOAL is a message now
-- ---------------------------------------------------------------------
do $realtime$
begin
  execute 'alter publication supabase_realtime drop table goal_calls';
exception when others then null;
end $realtime$;

drop function if exists call_goal(uuid);
drop function if exists goal_burst(uuid);
drop table if exists goal_calls;

commit;
