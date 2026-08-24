-- =====================================================================
-- WASIF LAY — 0031: making a prediction
--
-- An upsert compiles to INSERT ... ON CONFLICT DO UPDATE, and Postgres
-- checks UPDATE privilege on every column in the SET list when the
-- statement is planned — not only when a conflict actually happens.
-- PostgREST puts every field you send into that list, so match_id and
-- user_id were in there too, and 0029 only granted update on the score
-- columns. Every pick failed, conflict or not.
--
-- Widening those grants would work and would also let someone move a
-- prediction between matches. An RPC is narrower and matches how every
-- other privileged write in this schema already works.
-- =====================================================================

begin;

create or replace function make_prediction(
  p_match uuid,
  p_home  integer,
  p_away  integer
)
returns void
language plpgsql security definer set search_path = public
as $$
declare m matches%rowtype;
begin
  if auth.uid() is null then
    raise exception 'NOT_SIGNED_IN' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from profiles
    where id = auth.uid() and not is_banned and deleted_at is null
  ) then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;

  select * into m from matches where id = p_match;
  if m.id is null then
    raise exception 'MATCH_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- The same rule the trigger enforces, checked here so the error is
  -- specific rather than arriving as a constraint violation.
  if not match_is_open(m) then
    raise exception 'MATCH_CLOSED' using errcode = 'P0001';
  end if;

  if p_home < 0 or p_home > 20 or p_away < 0 or p_away > 20 then
    raise exception 'SCORE_OUT_OF_RANGE' using errcode = 'P0001';
  end if;

  insert into predictions (match_id, user_id, home_score, away_score)
  values (p_match, auth.uid(), p_home, p_away)
  on conflict (match_id, user_id) do update
    set home_score = excluded.home_score,
        away_score = excluded.away_score;
end $$;

grant execute on function make_prediction(uuid, integer, integer) to authenticated;

-- Direct writes are no longer needed, and leaving them open would let a
-- client reach the table in ways the RPC deliberately doesn't allow.
revoke insert on predictions from authenticated;
revoke update on predictions from authenticated;

commit;
