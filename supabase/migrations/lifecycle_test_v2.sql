-- =====================================================================
-- WASIF LAY — lifecycle test
--
-- Run this whole file at once in the SQL editor. It creates a match,
-- walks it through every state, asserts what should be true at each
-- step, and rolls everything back — nothing it makes survives.
--
-- What it covers: the rules. Scoring, room states, the override, the
-- refusals, the cleanup. That's where the subtle bugs live and it's
-- what you can't check by tapping around.
--
-- What it can't cover: whether a change reaches a second device without
-- a reload. That needs two phones and there is no way around it.
--
-- Every line prints PASS or FAIL. Any FAIL is a real bug.
-- =====================================================================

begin;

do $test$
declare
  admin_id  uuid;
  m_id      uuid;
  r_id      uuid;
  state     text;
  pts       integer;
  tier      text;
  n         integer;
  ok        boolean;
  failures  integer := 0;
begin
  -- Impersonate an admin: is_staff() reads auth.uid(), which is null in
  -- the SQL editor, so every staff function would refuse.
  select id into admin_id from profiles where role = 'admin' limit 1;
  if admin_id is null then
    raise exception 'No admin account — promote one first.';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', admin_id)::text, true);

  raise notice '--- scoring ladder ---';

  ok := score_tier(3,1,3,1) = 'exact';
  raise notice '% exact score', case when ok then 'PASS' else 'FAIL' end;
  if not ok then failures := failures + 1; end if;

  ok := score_tier(2,0,3,1) = 'margin';
  raise notice '% right winner and margin', case when ok then 'PASS' else 'FAIL' end;
  if not ok then failures := failures + 1; end if;

  ok := score_tier(4,1,3,1) = 'winner';
  raise notice '% right winner only', case when ok then 'PASS' else 'FAIL' end;
  if not ok then failures := failures + 1; end if;

  ok := score_tier(1,3,3,1) = 'goals';
  raise notice '% wrong winner, right total', case when ok then 'PASS' else 'FAIL' end;
  if not ok then failures := failures + 1; end if;

  ok := score_tier(0,2,3,1) = 'none';
  raise notice '% nothing right', case when ok then 'PASS' else 'FAIL' end;
  if not ok then failures := failures + 1; end if;

  ok := score_tier(1,1,2,2) = 'margin';
  raise notice '% draw called, wrong score', case when ok then 'PASS' else 'FAIL' end;
  if not ok then failures := failures + 1; end if;

  ok := (tier_points('exact') * round_multiplier('final'))::integer = 30;
  raise notice '% exact in the final is worth 30', case when ok then 'PASS' else 'FAIL' end;
  if not ok then failures := failures + 1; end if;

  ok := (tier_points('margin') * round_multiplier('quarter'))::integer = 9;
  raise notice '% multipliers land on whole numbers', case when ok then 'PASS' else 'FAIL' end;
  if not ok then failures := failures + 1; end if;

  raise notice '--- creating a match ---';

  m_id := create_match('Test Home', 'Test Away', now() + interval '10 minutes', 'group');

  select room_id into r_id from matches where id = m_id;
  ok := r_id is not null;
  raise notice '% a room is opened with the match', case when ok then 'PASS' else 'FAIL' end;
  if not ok then failures := failures + 1; end if;

  select room_chat_state(r_id) into state;
  ok := state = 'waiting';
  raise notice '% before kickoff the room is waiting (got %)',
    case when ok then 'PASS' else 'FAIL' end, state;
  if not ok then failures := failures + 1; end if;

  raise notice '--- predictions ---';

  perform make_prediction(m_id, 3, 1);
  select count(*) into n from predictions where match_id = m_id;
  ok := n = 1;
  raise notice '% a prediction can be made before kickoff', case when ok then 'PASS' else 'FAIL' end;
  if not ok then failures := failures + 1; end if;

  perform make_prediction(m_id, 2, 2);
  select home_score into n from predictions where match_id = m_id and user_id = admin_id;
  ok := n = 2;
  raise notice '% a prediction can be changed', case when ok then 'PASS' else 'FAIL' end;
  if not ok then failures := failures + 1; end if;

  perform make_prediction(m_id, 3, 1);

  begin
    perform make_prediction(m_id, 25, 0);
    raise notice 'FAIL a score above 20 was accepted';
    failures := failures + 1;
  exception when others then
    raise notice 'PASS a score above 20 is refused';
  end;

  raise notice '--- the override ---';

  perform set_room_chat(m_id, 'open');
  select room_chat_state(r_id) into state;
  ok := state = 'open';
  raise notice '% a room can be opened before kickoff (got %)',
    case when ok then 'PASS' else 'FAIL' end, state;
  if not ok then failures := failures + 1; end if;

  perform set_room_chat(m_id, 'closed');
  select room_chat_state(r_id) into state;
  ok := state = 'closed';
  raise notice '% a room can be paused (got %)',
    case when ok then 'PASS' else 'FAIL' end, state;
  if not ok then failures := failures + 1; end if;

  perform set_room_chat(m_id, null);
  select room_chat_state(r_id) into state;
  ok := state = 'waiting';
  raise notice '% clearing the override restores the clock (got %)',
    case when ok then 'PASS' else 'FAIL' end, state;
  if not ok then failures := failures + 1; end if;

  raise notice '--- kickoff ---';

  update matches set kicks_off_at = now() - interval '1 minute' where id = m_id;

  select room_chat_state(r_id) into state;
  ok := state = 'open';
  raise notice '% the room opens once kickoff passes (got %)',
    case when ok then 'PASS' else 'FAIL' end, state;
  if not ok then failures := failures + 1; end if;

  begin
    perform make_prediction(m_id, 1, 0);
    raise notice 'FAIL a prediction was accepted after kickoff';
    failures := failures + 1;
  exception when others then
    raise notice 'PASS predictions are refused after kickoff';
  end;

  raise notice '--- the result ---';

  select set_match_result(m_id, 3, 1) into n;
  ok := n = 1;
  raise notice '% the result scores every prediction (scored %)',
    case when ok then 'PASS' else 'FAIL' end, n;
  if not ok then failures := failures + 1; end if;

  select points, predictions.tier into pts, tier
    from predictions where match_id = m_id and user_id = admin_id;
  ok := tier = 'exact' and pts = 10;
  raise notice '% an exact call scores 10 (got %, %)',
    case when ok then 'PASS' else 'FAIL' end, tier, pts;
  if not ok then failures := failures + 1; end if;

  select room_chat_state(r_id) into state;
  ok := state = 'closed';
  raise notice '% the room closes on the result (got %)',
    case when ok then 'PASS' else 'FAIL' end, state;
  if not ok then failures := failures + 1; end if;

  perform set_room_chat(m_id, 'open');
  select room_chat_state(r_id) into state;
  ok := state = 'closed';
  raise notice '% a finished match cannot be reopened (got %)',
    case when ok then 'PASS' else 'FAIL' end, state;
  if not ok then failures := failures + 1; end if;
  perform set_room_chat(m_id, null);

  raise notice '--- the grace period ---';

  update matches set finished_at = now() - interval '2 hours' where id = m_id;
  select room_chat_state(r_id) into state;
  ok := state = 'expired';
  raise notice '% the room expires an hour after the result (got %)',
    case when ok then 'PASS' else 'FAIL' end, state;
  if not ok then failures := failures + 1; end if;

  select count(*) into n from public_rooms where id = r_id;
  ok := n = 0;
  raise notice '% an expired room leaves the list', case when ok then 'PASS' else 'FAIL' end;
  if not ok then failures := failures + 1; end if;

  raise notice '--- correcting a result ---';

  select set_match_result(m_id, 2, 2) into n;
  select points, predictions.tier into pts, tier
    from predictions where match_id = m_id and user_id = admin_id;
  ok := tier = 'margin' and pts = 6;
  raise notice '% rescoring overwrites rather than adds (got %, %)',
    case when ok then 'PASS' else 'FAIL' end, tier, pts;
  if not ok then failures := failures + 1; end if;

  raise notice '--- deleting ---';

  perform delete_match(m_id);

  select count(*) into n from matches where id = m_id;
  ok := n = 0;
  raise notice '% the match is gone', case when ok then 'PASS' else 'FAIL' end;
  if not ok then failures := failures + 1; end if;

  select count(*) into n from rooms where id = r_id;
  ok := n = 0;
  raise notice '% its room goes with it', case when ok then 'PASS' else 'FAIL' end;
  if not ok then failures := failures + 1; end if;

  select count(*) into n from predictions where match_id = m_id;
  ok := n = 0;
  raise notice '% its predictions go with it', case when ok then 'PASS' else 'FAIL' end;
  if not ok then failures := failures + 1; end if;

  raise notice '--- existing data ---';

  select count(*) into n from rooms r
   where r.type = 'match'
     and not exists (select 1 from matches m where m.room_id = r.id);
  ok := n = 0;
  raise notice '% no orphaned match rooms (found %)',
    case when ok then 'PASS' else 'FAIL' end, n;
  if not ok then failures := failures + 1; end if;

  select count(*) into n from matches
   where room_id is null and status <> 'cancelled';
  ok := n = 0;
  raise notice '% every live match has a room (missing %)',
    case when ok then 'PASS' else 'FAIL' end, n;
  if not ok then failures := failures + 1; end if;

  select count(*) into n from pg_publication_tables
   where pubname = 'supabase_realtime'
     and tablename in ('messages','matches','predictions','posts','answers','rooms');
  ok := n = 6;
  raise notice '% all six tables are published for realtime (found %)',
    case when ok then 'PASS' else 'FAIL' end, n;
  if not ok then failures := failures + 1; end if;

  raise notice '';
  if failures = 0 then
    raise notice '=== all checks passed ===';
  else
    raise notice '=== % FAILED ===', failures;
  end if;
end $test$;

-- Nothing this created survives.
rollback;
