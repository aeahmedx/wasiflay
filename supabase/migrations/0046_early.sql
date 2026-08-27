-- =====================================================================
-- WASIF LAY — 0046: being early
--
-- Two changes, both about the same problem: a page that has to look
-- alive when the numbers are small, without saying anything untrue.
--
-- 1. Names are held back until a few real people have picked. One
--    lonely name says "nobody is here" louder than saying nothing at
--    all does. Five is enough to read as a group.
--
-- 2. Your position among pickers, which is the one number that
--    flatters precisely when the total doesn't. "You're 4th to pick"
--    is a boast at four people and meaningless at four hundred —
--    exactly the opposite of a running total, and exactly what's
--    needed in the week before anyone has arrived.
-- =====================================================================

begin;

/**
 * Where someone came in the order of picks for a match.
 *
 * Null if they haven't picked. Counts every prediction ever made on
 * the match, so it doesn't move when other people change theirs — a
 * position that drifts isn't a position.
 */
create or replace function my_pick_position(p_match uuid)
returns integer
language sql stable security definer set search_path = public
as $$
  select count(*)::integer
  from predictions pr
  where pr.match_id = p_match
    and pr.created_at <= (
      select mine.created_at from predictions mine
       where mine.match_id = p_match and mine.user_id = auth.uid()
    );
$$;

grant execute on function my_pick_position(uuid) to authenticated;

/** Below this, names are hidden rather than shown thinly. */
create or replace function gate_name_threshold()
returns integer language sql immutable as $$ select 5 $$;

drop function if exists gate_state();

create or replace function gate_state()
returns table (
  is_open          boolean,
  opens_at         timestamptz,
  forced           boolean,
  match_id         uuid,
  home_team        text,
  away_team        text,
  kicks_off_at     timestamptz,
  teams_announced  boolean,
  prediction_count integer,
  my_home          integer,
  my_away          integer,
  recent_names     text[],
  my_position      integer
)
language sql stable security definer set search_path = public
as $$
  select
    gate_is_open(),
    s.gate_opens_at,
    s.gate_forced_open,
    m.id,
    m.home_team,
    m.away_team,
    m.kicks_off_at,
    (m.id is not null
       and coalesce(trim(m.home_team), '') <> ''
       and lower(trim(m.home_team)) <> 'tbd'
       and lower(trim(m.away_team)) <> 'tbd'),
    coalesce(
      (select count(*)::integer from predictions pr where pr.match_id = m.id),
      0
    ),
    (select pr.home_score from predictions pr
      where pr.match_id = m.id and pr.user_id = auth.uid()),
    (select pr.away_score from predictions pr
      where pr.match_id = m.id and pr.user_id = auth.uid()),
    -- Held back until there are enough to read as a group. Every name
    -- returned is a real person who really picked.
    case
      when coalesce(
             (select count(*) from predictions pr where pr.match_id = m.id),
             0
           ) >= gate_name_threshold()
      then coalesce(
             (select array_agg(rp.display_name order by rp.picked_at desc)
                from recent_pickers(m.id, 8) rp),
             '{}'::text[]
           )
      else '{}'::text[]
    end,
    my_pick_position(m.id)
  from site_settings s
  left join matches m
         on m.id = s.featured_match_id and m.status <> 'cancelled'
  where s.id;
$$;

grant execute on function gate_state() to anon, authenticated;

commit;
