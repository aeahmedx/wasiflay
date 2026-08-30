-- =====================================================================
-- WASIF LAY — the SASF Silver Jubilee schedule
--
-- 31 fixtures: 24 group matches across six Saturday slots, then seven
-- knockout ties on Sunday.
--
-- Times are written with an explicit -04 offset, which is EDT — what
-- Middletown is on those dates. Storing "08:00" without an offset
-- would be read as UTC and every kickoff would land four hours early,
-- which is the kind of mistake nobody notices until a room opens at
-- four in the morning.
--
-- Knockout ties carry placeholder names, because the teams genuinely
-- aren't known yet. They can be renamed from /mod as results come in,
-- and renaming a match renames its room with it.
--
-- Safe to run twice: a fixture already at the same time with the same
-- teams is skipped rather than duplicated.
-- =====================================================================

begin;

with incoming (home_team, away_team, kicks_off_at, round) as (
  values
    ('Colorado', 'Virginia', timestamptz '2026-09-05 08:00:00-04', 'group'),
    ('Boston', 'Arizona', timestamptz '2026-09-05 08:00:00-04', 'group'),
    ('Richmond', 'New York City', timestamptz '2026-09-05 08:00:00-04', 'group'),
    ('Washington D.C.', 'TBD', timestamptz '2026-09-05 08:00:00-04', 'group'),
    ('Philadelphia', 'Nebraska', timestamptz '2026-09-05 09:30:00-04', 'group'),
    ('Ohio', 'Indiana', timestamptz '2026-09-05 09:30:00-04', 'group'),
    ('Michigan', 'California', timestamptz '2026-09-05 09:30:00-04', 'group'),
    ('Connecticut', 'Pennsylvania', timestamptz '2026-09-05 09:30:00-04', 'group'),
    ('Colorado', 'Nebraska', timestamptz '2026-09-05 11:00:00-04', 'group'),
    ('Boston', 'Indiana', timestamptz '2026-09-05 11:00:00-04', 'group'),
    ('Richmond', 'California', timestamptz '2026-09-05 11:00:00-04', 'group'),
    ('Washington D.C.', 'Pennsylvania', timestamptz '2026-09-05 11:00:00-04', 'group'),
    ('Philadelphia', 'Virginia', timestamptz '2026-09-05 12:30:00-04', 'group'),
    ('Ohio', 'Arizona', timestamptz '2026-09-05 12:30:00-04', 'group'),
    ('Michigan', 'New York City', timestamptz '2026-09-05 12:30:00-04', 'group'),
    ('Connecticut', 'TBD', timestamptz '2026-09-05 12:30:00-04', 'group'),
    ('Colorado', 'Philadelphia', timestamptz '2026-09-05 14:00:00-04', 'group'),
    ('Boston', 'Ohio', timestamptz '2026-09-05 14:00:00-04', 'group'),
    ('Richmond', 'Michigan', timestamptz '2026-09-05 14:00:00-04', 'group'),
    ('Washington D.C.', 'Connecticut', timestamptz '2026-09-05 14:00:00-04', 'group'),
    ('Nebraska', 'Virginia', timestamptz '2026-09-05 15:30:00-04', 'group'),
    ('Indiana', 'Arizona', timestamptz '2026-09-05 15:30:00-04', 'group'),
    ('California', 'New York City', timestamptz '2026-09-05 15:30:00-04', 'group'),
    ('Pennsylvania', 'TBD', timestamptz '2026-09-05 15:30:00-04', 'group'),
    ('QF1 Winner A', 'Runner-up B', timestamptz '2026-09-06 08:30:00-04', 'quarter'),
    ('QF2 Winner B', 'Runner-up A', timestamptz '2026-09-06 08:30:00-04', 'quarter'),
    ('QF3 Winner C', 'Runner-up D', timestamptz '2026-09-06 08:30:00-04', 'quarter'),
    ('QF4 Winner D', 'Runner-up C', timestamptz '2026-09-06 08:30:00-04', 'quarter'),
    ('SF1 Winner QF1', 'Winner QF3', timestamptz '2026-09-06 11:30:00-04', 'semi'),
    ('SF2 Winner QF2', 'Winner QF4', timestamptz '2026-09-06 11:30:00-04', 'semi'),
    ('Winner SF1', 'Winner SF2', timestamptz '2026-09-06 15:30:00-04', 'final')
)
insert into matches (home_team, away_team, kicks_off_at, round, status)
select i.home_team, i.away_team, i.kicks_off_at, i.round::match_round, 'scheduled'
from incoming i
where not exists (
  select 1 from matches m
   where m.home_team = i.home_team
     and m.away_team = i.away_team
     and m.kicks_off_at = i.kicks_off_at
);

commit;

-- Rooms for everything that hasn't got one. Outside the transaction so
-- a failure here can't undo the fixtures above.
do $rooms$
declare r matches%rowtype;
begin
  for r in select * from matches where room_id is null and status <> 'cancelled'
  loop
    perform ensure_match_room(r.id);
  end loop;
end $rooms$;

-- Point the gate at the first match of the weekend.
update site_settings
   set featured_match_id = (
     select id from matches
      where status = 'scheduled'
      order by kicks_off_at
      limit 1
   )
 where id;

-- Check:
--   select to_char(kicks_off_at at time zone 'America/New_York', 'Dy DD HH24:MI') as local,
--          round, home_team, away_team, (room_id is not null) as has_room
--     from matches
--    order by kicks_off_at, home_team;
--
-- Saturday should read 08:00, 09:30, 11:00, 12:30, 14:00, 15:30 —
-- four matches at each.
