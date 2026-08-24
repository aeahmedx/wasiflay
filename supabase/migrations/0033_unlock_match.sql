-- =====================================================================
-- WASIF LAY — 0033: unlocking a match
--
-- Locking was one-way, which is wrong for how these weekends actually
-- run. A match gets locked, then the kickoff slips half an hour, and
-- everyone who arrived on time is shut out of a game that hasn't
-- started. Reopening has to be as easy as closing.
--
-- Unlocking clears the manual lock. It does NOT override kickoff: if
-- the scheduled time has passed, match_is_open() still returns false,
-- so reopening a delayed match means moving its kickoff as well. That's
-- deliberate — a match whose time has passed shouldn't silently accept
-- picks from people watching it happen.
-- =====================================================================

begin;

create or replace function unlock_match(p_match uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare m matches%rowtype;
begin
  if not is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select * into m from matches where id = p_match;
  if m.id is null then
    raise exception 'MATCH_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- A finished match has scored predictions. Reopening it would let
  -- people pick a result they already know, so the result has to be
  -- cleared first — deliberately a separate, more considered action.
  if m.status = 'finished' then
    raise exception 'MATCH_FINISHED' using errcode = 'P0001';
  end if;

  update matches
     set locked_at = null,
         status = 'scheduled'
   where id = p_match;
end $$;

grant execute on function unlock_match(uuid) to authenticated;

commit;
