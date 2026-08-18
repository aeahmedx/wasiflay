-- =====================================================================
-- WASIF LAY — 0007: moderation queue
--
-- The mod panel needs three things clients cannot read directly:
--   * author_id on reported posts/answers/messages (revoked in 0004)
--   * the content of REMOVED items, to review a decision
--   * the reporter's name
--
-- One SECURITY DEFINER function returns an enriched queue. It is guarded
-- by is_staff(), so an ordinary user calling it gets nothing.
-- =====================================================================

begin;

create or replace function mod_report_queue(
  p_status report_status default 'open',
  p_limit  integer       default 100
)
returns table (
  report_id     uuid,
  target_type   report_target,
  target_id     uuid,
  reason        text,
  status        report_status,
  reported_at   timestamptz,
  reporter_id   uuid,
  reporter_name text,
  author_id     uuid,
  author_name   text,
  preview       text,
  is_anonymous  boolean,
  is_removed    boolean,
  author_banned boolean
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  return query
  select r.id,
         r.target_type,
         r.target_id,
         r.reason,
         r.status,
         r.created_at,
         r.reporter_id,
         rp.display_name,
         case r.target_type
           when 'post'    then p.author_id
           when 'answer'  then a.author_id
           when 'message' then m.author_id
           when 'listing' then l.submitted_by
           when 'profile' then tp.id
         end,
         case r.target_type
           when 'post'    then pa.display_name
           when 'answer'  then aa.display_name
           when 'message' then ma.display_name
           when 'listing' then la.display_name
           when 'profile' then tp.display_name
         end,
         case r.target_type
           when 'post'    then left(coalesce(p.title,'') || ' — ' || coalesce(p.body,''), 300)
           when 'answer'  then left(coalesce(a.body,''), 300)
           when 'message' then left(coalesce(m.body,'') ||
                                    case when m.image_url is not null
                                         then ' [image]' else '' end, 300)
           when 'listing' then left(coalesce(l.name,'') || ' — ' ||
                                    coalesce(l.description,''), 300)
           when 'profile' then coalesce(tp.display_name,'')
         end,
         case r.target_type
           when 'post'   then p.is_anonymous
           when 'answer' then a.is_anonymous
           else false
         end,
         case r.target_type
           when 'post'    then p.is_removed
           when 'answer'  then a.is_removed
           when 'message' then m.is_removed
           when 'listing' then l.is_removed
           when 'profile' then tp.is_banned
         end,
         case r.target_type
           when 'post'    then pa.is_banned
           when 'answer'  then aa.is_banned
           when 'message' then ma.is_banned
           when 'listing' then la.is_banned
           when 'profile' then tp.is_banned
         end
  from reports r
  left join profiles rp on rp.id = r.reporter_id
  left join posts    p  on r.target_type = 'post'    and p.id  = r.target_id
  left join answers  a  on r.target_type = 'answer'  and a.id  = r.target_id
  left join messages m  on r.target_type = 'message' and m.id  = r.target_id
  left join listings l  on r.target_type = 'listing' and l.id  = r.target_id
  left join profiles tp on r.target_type = 'profile' and tp.id = r.target_id
  left join profiles pa on pa.id = p.author_id
  left join profiles aa on aa.id = a.author_id
  left join profiles ma on ma.id = m.author_id
  left join profiles la on la.id = l.submitted_by
  where r.status = p_status
  order by r.created_at desc
  limit p_limit;
end $$;

grant execute on function mod_report_queue(report_status, integer)
  to authenticated;

-- Count for the panel badge.
create or replace function mod_open_report_count()
returns integer
language sql stable security definer set search_path = public
as $$
  select case
    when is_staff() then (select count(*)::integer from reports where status = 'open')
    else 0
  end;
$$;

grant execute on function mod_open_report_count() to authenticated;

-- ---------------------------------------------------------------------
-- Live removal: without REPLICA IDENTITY FULL, UPDATE events on messages
-- don't carry enough of the row for subscribers to act on. A message
-- removed by a moderator would stay on screen for everyone already in
-- the room until they reloaded — useless during a live event.
-- ---------------------------------------------------------------------
alter table messages replica identity full;

commit;

-- Verify as an ordinary user (should raise FORBIDDEN):
--   select * from mod_report_queue();
