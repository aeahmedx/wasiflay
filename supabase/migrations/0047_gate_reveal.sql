-- =====================================================================
-- WASIF LAY — 0047: revealing the schedule
--
-- A countdown alone gives someone one reason to visit and none to
-- return. The whole schedule at once gives them everything on day one
-- and nothing after.
--
-- So the gate shows the first N fixtures, and N goes up when you say
-- so. Someone who picked two matches on Monday has four waiting on
-- Wednesday. Nothing is fabricated — the fixtures are real and the
-- reveal is a decision, the same way a schedule release is.
--
-- Deliberately a count rather than dates: it keeps the pacing in your
-- hands on the day, rather than in a cron job that fires while you're
-- asleep and can't be undone.
-- =====================================================================

begin;

/**
 * Where a fixture sits in the tournament.
 *
 * A pick screen that says only "Colorado v Virginia" is asking someone
 * to judge two names. The same fixture labelled "Group A · Field 1" is
 * legible as part of a real weekend, which is most of what makes a
 * guess feel worth making.
 */
alter table matches
  add column if not exists group_label text,
  add column if not exists field_label text;

alter table site_settings
  add column if not exists gate_reveal_count integer not null default 1;

/**
 * The fixtures visible on the gate, soonest first.
 *
 * Only scheduled matches — one that has kicked off has no business on
 * a page whose entire purpose is picking before kickoff.
 */
-- Dropped first because two columns are being added to what it
-- returns. A function's OUT parameters define its row type, and
-- Postgres won't replace one row type with a different one.
drop function if exists gate_matches();

create or replace function gate_matches()
returns table (
  id               uuid,
  home_team        text,
  away_team        text,
  kicks_off_at     timestamptz,
  round            match_round,
  group_label      text,
  field_label      text,
  teams_announced  boolean,
  prediction_count integer,
  my_home          integer,
  my_away          integer
)
language sql stable security definer set search_path = public
as $$
  select m.id, m.home_team, m.away_team, m.kicks_off_at, m.round,
         m.group_label, m.field_label,
         (coalesce(trim(m.home_team), '') <> ''
            and lower(trim(m.home_team)) not like 'tbd%'
            and lower(trim(m.away_team)) not like 'tbd%'),
         (select count(*)::integer from predictions pr where pr.match_id = m.id),
         (select pr.home_score from predictions pr
           where pr.match_id = m.id and pr.user_id = auth.uid()),
         (select pr.away_score from predictions pr
           where pr.match_id = m.id and pr.user_id = auth.uid())
  from matches m
  where m.status = 'scheduled'
    and m.kicks_off_at > now()
  order by m.kicks_off_at, m.home_team
  limit greatest(
    coalesce((select gate_reveal_count from site_settings where id), 1),
    1
  );
$$;

grant execute on function gate_matches() to anon, authenticated;

/** How many are on the gate, and how many could be. */
create or replace function gate_reveal()
returns table (revealed integer, available integer)
language sql stable security definer set search_path = public
as $$
  select
    greatest(coalesce((select gate_reveal_count from site_settings where id), 1), 1),
    (select count(*)::integer from matches
      where status = 'scheduled' and kicks_off_at > now());
$$;

grant execute on function gate_reveal() to authenticated;

create or replace function set_gate_reveal(p_count integer)
returns integer
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'ADMIN_ONLY' using errcode = 'P0001';
  end if;

  update site_settings
     set gate_reveal_count = greatest(p_count, 1),
         updated_by = auth.uid(),
         updated_at = now()
   where id;

  return greatest(p_count, 1);
end $$;

grant execute on function set_gate_reveal(integer) to authenticated;

commit;
