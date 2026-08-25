-- =====================================================================
-- WASIF LAY — 0045: who has already picked
--
-- The most persuasive thing on the gate isn't a photo — it's evidence
-- that people you know are already in. A name is worth more than a
-- number, and both are worth more than a countdown alone.
--
-- Names only, never scores. Picks stay hidden until kickoff, and the
-- gate is not an exception: showing "Ahmed called 3–1" a week early
-- would let anyone copy the pick of whoever they rate. The rule holds
-- everywhere or it holds nowhere.
-- =====================================================================

begin;

create or replace function recent_pickers(
  p_match uuid,
  p_limit integer default 8
)
returns table (
  display_name text,
  picked_at    timestamptz
)
language sql stable security definer set search_path = public
as $$
  select p.display_name, pr.created_at
  from predictions pr
  join profiles p on p.id = pr.user_id
  where pr.match_id = p_match
    and not p.is_banned
    and p.deleted_at is null
    -- Blocking applies here as everywhere else.
    and not exists (
      select 1 from blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = pr.user_id)
         or (b.blocked_id = auth.uid() and b.blocker_id = pr.user_id)
    )
  order by pr.created_at desc
  limit p_limit;
$$;

grant execute on function recent_pickers(uuid, integer) to anon, authenticated;

-- The gate needs these names alongside everything else it already asks
-- for, so they arrive in the same call rather than a second round trip
-- that could show a count and a list out of step with each other.
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
  recent_names     text[]
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
    coalesce(
      (select array_agg(rp.display_name order by rp.picked_at desc)
         from recent_pickers(m.id, 8) rp),
      '{}'::text[]
    )
  from site_settings s
  left join matches m
         on m.id = s.featured_match_id and m.status <> 'cancelled'
  where s.id;
$$;

grant execute on function gate_state() to anon, authenticated;

commit;
