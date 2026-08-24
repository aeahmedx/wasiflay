-- =====================================================================
-- WASIF LAY — 0032: deleting a match
--
-- Cancelling already exists and is usually the right call — it hides a
-- match while keeping the record, so predictions and points survive.
--
-- Deleting is for the other case: a match entered by mistake, or a
-- duplicate. It takes the predictions with it, which means everyone who
-- picked it loses those points. That's correct — a match that never
-- happened shouldn't award anything — but it changes other people's
-- scores without telling them, so it's admin-only rather than staff.
--
-- The room is unlinked, never deleted. A room may hold a conversation
-- that outlives the fixture it was attached to.
-- =====================================================================

begin;

create or replace function delete_match(p_match uuid)
returns table (
  deleted_predictions integer,
  had_room             boolean
)
language plpgsql security definer set search_path = public
as $$
declare
  n_preds integer;
  room    uuid;
begin
  if not is_admin() then
    raise exception 'ADMIN_ONLY' using errcode = 'P0001';
  end if;

  select count(*)::integer into n_preds
    from predictions where match_id = p_match;

  select room_id into room from matches where id = p_match;

  -- Unlink rather than delete: the conversation can outlive the fixture.
  update matches set room_id = null where id = p_match;

  -- predictions.match_id cascades, so this clears them and their points
  -- in one step. The leaderboard recomputes from what's left, so scores
  -- correct themselves the next time anyone looks.
  delete from matches where id = p_match;

  return query select n_preds, room is not null;
end $$;

grant execute on function delete_match(uuid) to authenticated;

/**
 * How much damage a delete would do, so it can be stated before it
 * happens rather than discovered afterwards.
 */
create or replace function match_delete_impact(p_match uuid)
returns table (
  prediction_count integer,
  points_awarded   integer,
  people_affected  integer,
  has_room         boolean
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  return query
  select count(*)::integer,
         coalesce(sum(pr.points), 0)::integer,
         count(distinct pr.user_id)::integer,
         exists (select 1 from matches m where m.id = p_match and m.room_id is not null)
  from predictions pr
  where pr.match_id = p_match;
end $$;

grant execute on function match_delete_impact(uuid) to authenticated;

commit;
