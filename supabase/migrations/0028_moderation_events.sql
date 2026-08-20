-- =====================================================================
-- WASIF LAY — 0028: moderation handles events
--
-- 0026 made 'event' a valid report target, so people can report one.
-- But mod_remove, mod_restore, admin_hard_delete and the report queue
-- were all written before events existed — a moderator acting on a
-- reported event would have hit UNSUPPORTED_TARGET, and the queue would
-- have shown an entry with no content to look at.
-- =====================================================================

begin;

create or replace function mod_remove(p_target report_target, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if    p_target = 'post'    then update posts    set is_removed = true, removed_by = auth.uid(), removed_at = now() where id = p_id;
  elsif p_target = 'answer'  then update answers  set is_removed = true, removed_by = auth.uid(), removed_at = now() where id = p_id;
  elsif p_target = 'message' then update messages set is_removed = true, removed_by = auth.uid(), removed_at = now() where id = p_id;
  elsif p_target = 'listing' then update listings set is_removed = true, removed_by = auth.uid(), removed_at = now() where id = p_id;
  elsif p_target = 'event'   then update events   set is_removed = true, removed_by = auth.uid(), removed_at = now() where id = p_id;
  else  raise exception 'UNSUPPORTED_TARGET' using errcode = 'P0001';
  end if;
end $$;

create or replace function mod_restore(p_target report_target, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if    p_target = 'post'    then update posts    set is_removed = false, removed_by = null, removed_at = null where id = p_id;
  elsif p_target = 'answer'  then update answers  set is_removed = false, removed_by = null, removed_at = null where id = p_id;
  elsif p_target = 'message' then update messages set is_removed = false, removed_by = null, removed_at = null where id = p_id;
  elsif p_target = 'listing' then update listings set is_removed = false, removed_by = null, removed_at = null where id = p_id;
  elsif p_target = 'event'   then update events   set is_removed = false, removed_by = null, removed_at = null where id = p_id;
  else  raise exception 'UNSUPPORTED_TARGET' using errcode = 'P0001';
  end if;
end $$;

create or replace function admin_hard_delete(p_target report_target, p_id uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare removed integer := 0;
        n integer;
begin
  if not is_admin() then
    raise exception 'ADMIN_ONLY' using errcode = 'P0001';
  end if;

  if p_target = 'profile' then
    raise exception 'CANNOT_DELETE_PROFILE' using errcode = 'P0001';
  end if;

  delete from reports where target_type = p_target and target_id = p_id;

  if p_target = 'post' then
    delete from votes
     where (target_type = 'post' and target_id = p_id)
        or (target_type = 'answer'
            and target_id in (select id from answers where post_id = p_id));
    delete from reports
     where target_type = 'answer'
       and target_id in (select id from answers where post_id = p_id);
    delete from posts where id = p_id;
    get diagnostics n = row_count; removed := n;

  elsif p_target = 'answer' then
    delete from votes where target_type = 'answer' and target_id = p_id;
    delete from answers where id = p_id;
    get diagnostics n = row_count; removed := n;

  elsif p_target = 'message' then
    delete from messages where id = p_id;
    get diagnostics n = row_count; removed := n;

  elsif p_target = 'listing' then
    delete from vouches where listing_id = p_id;
    delete from listings where id = p_id;
    get diagnostics n = row_count; removed := n;

  elsif p_target = 'event' then
    -- RSVPs are contact details; deleting the event takes them with it.
    -- Questions asked about the event survive with the link cleared,
    -- because other people wrote the answers.
    delete from event_rsvps where event_id = p_id;
    delete from events where id = p_id;
    get diagnostics n = row_count; removed := n;
  end if;

  return removed;
end $$;

grant execute on function admin_hard_delete(report_target, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- The queue needs something to show for a reported event
-- ---------------------------------------------------------------------
create or replace function mod_report_queue(
  p_status report_status default 'open',
  p_limit  integer       default 100
)
returns table (
  target_type    report_target,
  target_id      uuid,
  report_count   integer,
  reasons        text,
  first_reported timestamptz,
  last_reported  timestamptz,
  reporter_names text,
  author_id      uuid,
  author_name    text,
  author_role    user_role,
  author_banned  boolean,
  preview        text,
  image_url      text,
  is_anonymous   boolean,
  is_removed     boolean,
  claimed_by     uuid,
  claimed_name   text,
  claim_fresh    boolean
)
language plpgsql stable security definer set search_path = public
as $$
#variable_conflict use_column
begin
  if not is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  return query
  with grouped as (
    select r.target_type,
           r.target_id,
           count(*)::integer                    as report_count,
           string_agg(distinct r.reason, ' · ') as reasons,
           min(r.created_at)                    as first_reported,
           max(r.created_at)                    as last_reported,
           string_agg(distinct coalesce(rp.display_name, 'Automatic'), ', ')
             as reporter_names,
           (array_agg(r.claimed_by order by r.claimed_at desc nulls last))[1] as claimed_by,
           (array_agg(r.claimed_at order by r.claimed_at desc nulls last))[1] as claimed_at
    from reports r
    left join profiles rp on rp.id = r.reporter_id
    where r.status = p_status
    group by r.target_type, r.target_id
  )
  select g.target_type, g.target_id, g.report_count, g.reasons,
         g.first_reported, g.last_reported, g.reporter_names,
         case g.target_type
           when 'post'    then p.author_id
           when 'answer'  then a.author_id
           when 'message' then m.author_id
           when 'listing' then l.submitted_by
           when 'event'   then ev.creator_id
           when 'profile' then tp.id
         end,
         case g.target_type
           when 'post'    then pa.display_name
           when 'answer'  then aa.display_name
           when 'message' then ma.display_name
           when 'listing' then la.display_name
           when 'event'   then ea.display_name
           when 'profile' then tp.display_name
         end,
         case g.target_type
           when 'post'    then pa.role
           when 'answer'  then aa.role
           when 'message' then ma.role
           when 'listing' then la.role
           when 'event'   then ea.role
           when 'profile' then tp.role
         end,
         case g.target_type
           when 'post'    then pa.is_banned
           when 'answer'  then aa.is_banned
           when 'message' then ma.is_banned
           when 'listing' then la.is_banned
           when 'event'   then ea.is_banned
           when 'profile' then tp.is_banned
         end,
         case g.target_type
           when 'post'    then left(coalesce(p.title,'') || ' — ' || coalesce(p.body,''), 300)
           when 'answer'  then left(coalesce(a.body,''), 300)
           when 'message' then left(coalesce(m.body,'') ||
                                    case when m.image_url is not null then ' [image]' else '' end, 300)
           when 'listing' then left(coalesce(l.name,'') || ' — ' || coalesce(l.description,''), 300)
           when 'event'   then left(coalesce(ev.title,'') || ' — ' || coalesce(ev.description,''), 300)
           when 'profile' then coalesce(tp.display_name,'')
         end,
         case g.target_type when 'message' then m.image_url else null end,
         case g.target_type
           when 'post'   then p.is_anonymous
           when 'answer' then a.is_anonymous
           else false
         end,
         case g.target_type
           when 'post'    then p.is_removed
           when 'answer'  then a.is_removed
           when 'message' then m.is_removed
           when 'listing' then l.is_removed
           when 'event'   then ev.is_removed
           when 'profile' then tp.is_banned
         end,
         g.claimed_by, cb.display_name,
         (g.claimed_by is not null and g.claimed_at > now() - claim_ttl())
  from grouped g
  left join posts    p  on g.target_type = 'post'    and p.id  = g.target_id
  left join answers  a  on g.target_type = 'answer'  and a.id  = g.target_id
  left join messages m  on g.target_type = 'message' and m.id  = g.target_id
  left join listings l  on g.target_type = 'listing' and l.id  = g.target_id
  left join events   ev on g.target_type = 'event'   and ev.id = g.target_id
  left join profiles tp on g.target_type = 'profile' and tp.id = g.target_id
  left join profiles pa on pa.id = p.author_id
  left join profiles aa on aa.id = a.author_id
  left join profiles ma on ma.id = m.author_id
  left join profiles la on la.id = l.submitted_by
  left join profiles ea on ea.id = ev.creator_id
  left join profiles cb on cb.id = g.claimed_by
  order by g.report_count desc, g.last_reported desc
  limit p_limit;
end $$;

grant execute on function mod_report_queue(report_status, integer) to authenticated;

-- ---------------------------------------------------------------------
-- The removed-content audit needs events too
-- ---------------------------------------------------------------------
create or replace function mod_removed_content(
  p_limit integer default 100,
  p_kind  text    default 'all'
)
returns table (
  target_type  report_target,
  target_id    uuid,
  preview      text,
  image_url    text,
  author_id    uuid,
  author_name  text,
  removed_by   uuid,
  removed_name text,
  by_author    boolean,
  removed_at   timestamptz,
  created_at   timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
#variable_conflict use_column
begin
  if not is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  return query
  select * from (
    select 'post'::report_target, p.id,
           left(coalesce(p.title,'') || ' — ' || coalesce(p.body,''), 300),
           null::text, p.author_id, pa.display_name, p.removed_by,
           rb.display_name, (p.removed_by is null), p.removed_at, p.created_at
    from posts p
    left join profiles pa on pa.id = p.author_id
    left join profiles rb on rb.id = p.removed_by
    where p.is_removed

    union all

    select 'answer'::report_target, a.id, left(coalesce(a.body,''), 300),
           null::text, a.author_id, aa.display_name, a.removed_by,
           rb.display_name, (a.removed_by is null), a.removed_at, a.created_at
    from answers a
    left join profiles aa on aa.id = a.author_id
    left join profiles rb on rb.id = a.removed_by
    where a.is_removed

    union all

    select 'message'::report_target, m.id, left(coalesce(m.body,''), 300),
           m.image_url, m.author_id, ma.display_name, m.removed_by,
           rb.display_name, (m.removed_by is null), m.removed_at, m.created_at
    from messages m
    left join profiles ma on ma.id = m.author_id
    left join profiles rb on rb.id = m.removed_by
    where m.is_removed

    union all

    select 'event'::report_target, e.id,
           left(coalesce(e.title,'') || ' — ' || coalesce(e.description,''), 300),
           null::text, e.creator_id, ea.display_name, e.removed_by,
           rb.display_name, (e.removed_by is null), e.removed_at, e.created_at
    from events e
    left join profiles ea on ea.id = e.creator_id
    left join profiles rb on rb.id = e.removed_by
    where e.is_removed
  ) rows (target_type, target_id, preview, image_url, author_id,
          author_name, removed_by, removed_name, by_author,
          removed_at, created_at)
  where p_kind = 'all'
     or (p_kind = 'author'    and by_author)
     or (p_kind = 'moderator' and not by_author)
  order by removed_at desc nulls last
  limit p_limit;
end $$;

grant execute on function mod_removed_content(integer, text) to authenticated;

commit;
