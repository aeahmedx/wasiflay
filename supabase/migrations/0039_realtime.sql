-- =====================================================================
-- WASIF LAY — 0039: realtime for posts, answers, matches, predictions
--
-- Rooms have been live since 0001 because `messages` is in the realtime
-- publication. `posts` and `answers` never were — so a moderator
-- removing a post reached nobody who was reading it, and a permanently
-- deleted answer stayed on screen until the reader happened to
-- navigate.
--
-- Two more were subscribing to nothing and it would have shown on the
-- day: the tournament block watches `matches` so a lock reaches people
-- already looking at it, and the leaderboard watches `predictions` so a
-- result moves the board while people are standing there. Neither table
-- was published, so neither subscription ever fired.
--
-- Replica identity full matters as much as the publication: without it
-- a DELETE arrives with no primary key, so there is nothing to match
-- against and the row can't be removed from the page. That was already
-- set on messages in 0007; these need it too.
-- =====================================================================

begin;

alter table posts       replica identity full;
alter table answers     replica identity full;
alter table matches     replica identity full;
alter table predictions replica identity full;

commit;

-- Publication changes can't run inside the transaction above.
do $realtime$
begin
  begin
    execute 'alter publication supabase_realtime add table posts';
  exception when duplicate_object then null;
  end;

  begin
    execute 'alter publication supabase_realtime add table answers';
  exception when duplicate_object then null;
  end;

  begin
    execute 'alter publication supabase_realtime add table matches';
  exception when duplicate_object then null;
  end;

  begin
    execute 'alter publication supabase_realtime add table predictions';
  exception when duplicate_object then null;
  end;
end $realtime$;

-- Confirm:
--   select tablename from pg_publication_tables
--    where pubname = 'supabase_realtime'
--    order by tablename;
--
-- Expect at least: answers, matches, message_reactions, messages,
-- notifications, posts, predictions, reports.
