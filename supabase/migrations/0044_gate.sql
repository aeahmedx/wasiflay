-- =====================================================================
-- WASIF LAY — 0044: the gate
--
-- A week before the tournament, everyone who arrives sees a countdown
-- rather than the app. Not as a wall — sign-in works, and so does
-- predicting the first match. Someone who taps the link on Monday has
-- something to do and a reason to come back.
--
-- The prediction count is that reason. "12 people have picked" on
-- Monday and "180" on Thursday is the same page telling a different
-- story, and it's the only honest news a countdown can carry.
--
-- One function answers everything the gate needs, so nothing can
-- disagree with anything else about whether the app is open.
-- =====================================================================

begin;

alter table site_settings
  add column if not exists gate_opens_at     timestamptz,
  add column if not exists gate_forced_open  boolean not null default false,
  add column if not exists featured_match_id uuid references matches(id) on delete set null;

/**
 * Open or shut, and why.
 *
 * Time decides unless someone has forced it. gate_opens_at being null
 * means there is no gate at all — which is the state the app lives in
 * for the rest of its life, so it's the default.
 */
create or replace function gate_is_open()
returns boolean
language sql stable security definer set search_path = public
as $$
  select case
    when (select gate_forced_open from site_settings where id) then true
    when (select gate_opens_at from site_settings where id) is null then true
    else (select gate_opens_at from site_settings where id) <= now()
  end;
$$;

grant execute on function gate_is_open() to anon, authenticated;

/**
 * Everything the gate page renders, in one call.
 *
 * Including the prediction count, which is the whole reason to come
 * back before launch — and which the page would otherwise have to ask
 * for separately and risk showing out of step with the fixture.
 */
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
  my_away          integer
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
    -- A fixture can exist before its teams do. "TBD" is a real state
    -- during the week the schedule is still moving.
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
      where pr.match_id = m.id and pr.user_id = auth.uid())
  from site_settings s
  left join matches m
         on m.id = s.featured_match_id and m.status <> 'cancelled'
  where s.id;
$$;

grant execute on function gate_state() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------
create or replace function set_gate(
  p_opens_at timestamptz,
  p_forced   boolean default false
)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'ADMIN_ONLY' using errcode = 'P0001';
  end if;

  update site_settings
     set gate_opens_at = p_opens_at,
         gate_forced_open = p_forced,
         updated_by = auth.uid(),
         updated_at = now()
   where id;

  return gate_is_open();
end $$;

grant execute on function set_gate(timestamptz, boolean) to authenticated;

create or replace function set_featured_match(p_match uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'ADMIN_ONLY' using errcode = 'P0001';
  end if;

  update site_settings
     set featured_match_id = p_match,
         updated_by = auth.uid(),
         updated_at = now()
   where id;
end $$;

grant execute on function set_featured_match(uuid) to authenticated;

/**
 * Predicting has to work while the gate is shut — it is the only thing
 * anyone can do for a week, and the reason the countdown isn't a wall.
 *
 * make_prediction already checks that the match is open for picks, so
 * nothing about the gate changes what may be predicted. This exists so
 * the intent is written down rather than assumed by whoever reads
 * make_prediction next.
 */
comment on function make_prediction(uuid, integer, integer) is
  'Works while the gate is closed. Picking the featured match is the '
  'point of the gate; only kickoff closes it.';

commit;
