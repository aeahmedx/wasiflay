
-- The all-star game. A fixture like any other, which is the point —
-- it gets a room, picks and points without anything new being built.
insert into matches (home_team, away_team, kicks_off_at, round, status)
select 'Team Bebo', 'Team Shareef',
       timestamptz '2026-09-05 17:15:00-04', 'group', 'scheduled'
where not exists (
  select 1 from matches
   where home_team = 'Team Bebo' and away_team = 'Team Shareef'
);

do $room$
declare r matches%rowtype;
begin
  for r in select * from matches where room_id is null and status <> 'cancelled'
  loop
    perform ensure_match_room(r.id);
  end loop;
end $room$;
