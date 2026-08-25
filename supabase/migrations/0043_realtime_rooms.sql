-- =====================================================================
-- WASIF LAY — 0043: rooms in realtime
--
-- Pausing a room updates `rooms`. The room page watches `matches`,
-- because that's what closing on a result depends on — so a pause only
-- reached other devices on the eight-second poll.
--
-- Publishing rooms closes that: a moderator pausing a room reaches
-- everyone in it immediately, which is the entire point of having a
-- pause button rather than waiting for the match to end.
-- =====================================================================

begin;

-- Without full replica identity a DELETE arrives with no primary key,
-- so a deleted room can't be matched against what's on screen.
alter table rooms replica identity full;

commit;

do $realtime$
begin
  begin
    execute 'alter publication supabase_realtime add table rooms';
  exception when duplicate_object then null;
  end;
end $realtime$;

-- Confirm:
--   select tablename from pg_publication_tables
--    where pubname = 'supabase_realtime' order by tablename;
--
-- Expect: answers, matches, message_reactions, messages, notifications,
--         posts, predictions, reports, rooms.
