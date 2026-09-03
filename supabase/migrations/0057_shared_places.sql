-- =====================================================================
-- WASIF LAY — 0057: shared places
--
-- Standard competition ranking: equal points share a place, and the
-- next distinct score skips the places used up by the tie.
--
--   23 -> 1st
--   22 -> 2nd
--   22 -> 2nd
--   20 -> 4th
--   20 -> 4th
--   20 -> 4th
--   19 -> 7th
--
-- Before this, row_number() handed out 1, 2, 3, 4 regardless — so two
-- people on identical scores were told one of them was ahead, decided
-- by a tiebreaker they could not see. On a board where nobody has
-- scored yet, that put someone in 200th place for no reason.
--
-- The tiebreakers still order the rows, so the list is deterministic
-- and stable between page loads. They just no longer invent a gap that
-- the scores do not contain.
--
-- ---------------------------------------------------------------------
-- gap_above had to change with it
--
-- It looked up the row at rank - 1. With shared places that rank often
-- does not exist: on 1, 2, 2, 4 there is no rank 3, so anyone in 4th
-- was told they were 0 behind. It now asks for the nearest score above
-- yours, which is the question it was always trying to answer.
-- ---------------------------------------------------------------------
--
-- Return types are unchanged, so create or replace is safe here and no
-- caller needs updating.
-- =====================================================================

begin;

create or replace function leaderboard(p_limit integer default 50)
returns table (
  rank         integer,
  user_id      uuid,
  display_name text,
  country_flag text,
  points       integer,
  exact_count  integer,
  played       integer,
  is_me        boolean
)
language sql stable security definer set search_path = public
as $$
  with totals as (
    select pr.user_id,
           coalesce(sum(pr.points), 0)::integer                      as points,
           count(*) filter (where pr.tier = 'exact')::integer        as exact_count,
           count(*)::integer                                         as played,
           avg(extract(epoch from (m.kicks_off_at - pr.created_at)))  as lead_secs
    from predictions pr
    join matches m on m.id = pr.match_id
    group by pr.user_id
  ),
  ranked as (
    -- Banned and deleted accounts are filtered before the window runs,
    -- so they never occupy a place that then appears to be missing.
    select t.user_id,
           t.points,
           t.exact_count,
           t.played,
           t.lead_secs,
           p.display_name,
           p.country_flag,
           p.created_at as joined_at,
           rank() over (order by t.points desc) as place
    from totals t
    join profiles p on p.id = t.user_id
    where p.deleted_at is null and not p.is_banned
  )
  select r.place::integer,
         r.user_id,
         r.display_name,
         r.country_flag,
         r.points,
         r.exact_count,
         r.played,
         (r.user_id = auth.uid())
  from ranked r
  order by r.place,
           r.exact_count desc,
           r.played desc,
           r.lead_secs desc nulls last,
           r.joined_at asc
  limit p_limit;
$$;

grant execute on function leaderboard(integer) to anon, authenticated;

create or replace function my_standing()
returns table (
  rank        integer,
  points      integer,
  exact_count integer,
  played      integer,
  total       integer,
  gap_above   integer
)
language sql stable security definer set search_path = public
as $$
  with board as (
    select * from leaderboard(100000)
  ),
  me as (
    select * from board where is_me limit 1
  )
  select me.rank,
         me.points,
         me.exact_count,
         me.played,
         (select count(*)::integer from board),
         coalesce(
           -- The nearest score above yours, not the row at rank - 1:
           -- with shared places that rank frequently does not exist.
           (select min(b.points) from board b where b.points > me.points)
             - me.points,
           0
         )
  from me;
$$;

grant execute on function my_standing() to authenticated;

commit;

-- Check the shape of the places:
--   select rank, display_name, points from leaderboard(20);
--
-- Equal points must share a rank, and the rank after a tie must skip.
-- With nobody scored yet, every row should read 1.
--
-- Check your own gap:
--   select * from my_standing();
--
-- gap_above is 0 when you are level with the top, otherwise the points
-- between you and the nearest better score.
