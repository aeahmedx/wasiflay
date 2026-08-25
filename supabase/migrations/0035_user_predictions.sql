-- =====================================================================
-- WASIF LAY — 0035: a person's prediction record
--
-- Picks are the most social thing in the app — being publicly right is
-- the whole reward, and a record you can point at is what makes a
-- rivalry. So a profile shows what someone called and how it went.
--
-- The visibility rule from 0029 still holds and is enforced here rather
-- than trusted to the caller: picks on a match that is still open are
-- visible only to the person who made them. Otherwise a profile page
-- becomes a way to copy the leader's picks before kickoff.
-- =====================================================================

begin;

create or replace function user_predictions(
  p_user  uuid,
  p_limit integer default 60
)
returns table (
  match_id     uuid,
  home_team    text,
  away_team    text,
  kicks_off_at timestamptz,
  round        match_round,
  status       match_status,
  home_score   integer,
  away_score   integer,
  pick_home    integer,
  pick_away    integer,
  points       integer,
  tier         text
)
language sql stable security definer set search_path = public
as $$
  select m.id, m.home_team, m.away_team, m.kicks_off_at, m.round,
         m.status, m.home_score, m.away_score,
         pr.home_score, pr.away_score, pr.points, pr.tier
  from predictions pr
  join matches  m on m.id = pr.match_id
  join profiles p on p.id = pr.user_id
  where pr.user_id = p_user
    and m.status <> 'cancelled'
    and p.deleted_at is null
    -- Open matches are private until they close: a profile must not be
    -- a way to copy someone else's pick before kickoff.
    and (not match_is_open(m) or pr.user_id = auth.uid())
    -- Blocking applies here as everywhere else.
    and not exists (
      select 1 from blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p_user)
         or (b.blocked_id = auth.uid() and b.blocker_id = p_user)
    )
  order by m.kicks_off_at desc
  limit p_limit;
$$;

grant execute on function user_predictions(uuid, integer) to anon, authenticated;

/**
 * The headline numbers for a profile. Counts only scored matches, so a
 * pending pick doesn't read as a zero.
 */
create or replace function user_prediction_summary(p_user uuid)
returns table (
  played      integer,
  points      integer,
  exact_count integer,
  rank        integer
)
language sql stable security definer set search_path = public
as $$
  select
    count(*) filter (where pr.points is not null)::integer,
    coalesce(sum(pr.points), 0)::integer,
    count(*) filter (where pr.tier = 'exact')::integer,
    (select l.rank from leaderboard(100000) l where l.user_id = p_user)
  from predictions pr
  join matches m on m.id = pr.match_id
  where pr.user_id = p_user and m.status <> 'cancelled';
$$;

grant execute on function user_prediction_summary(uuid) to anon, authenticated;

commit;
