-- =====================================================================
-- WASIF LAY — 0015: permanent deletion (admin only)
--
-- Soft removal is right for almost everything: it keeps an audit trail
-- and it's reversible. But some content must actually be gone — a
-- posted phone number, an address, an image that should never have been
-- uploaded. "Removed but still in the database" is not an answer there.
--
-- Admin only, and irreversible. Moderators keep soft removal.
--
-- Cleanup matters: votes reference content polymorphically with no
-- foreign key, so deleting a post leaves orphaned vote rows behind that
-- would silently inflate counts if the id were ever reused.
-- =====================================================================

begin;

create or replace function admin_hard_delete(
  p_target report_target,
  p_id     uuid
)
returns integer
language plpgsql security definer set search_path = public
as $$
declare removed integer := 0;
        n integer;
begin
  if not is_admin() then
    raise exception 'ADMIN_ONLY' using errcode = 'P0001';
  end if;

  -- Profiles are out of scope: deleting an account cascades through
  -- every table and is not something to do from a moderation queue.
  if p_target = 'profile' then
    raise exception 'CANNOT_DELETE_PROFILE' using errcode = 'P0001';
  end if;

  -- Reports about this item go with it.
  delete from reports where target_type = p_target and target_id = p_id;

  if p_target = 'post' then
    -- Votes are polymorphic with no FK, so they must be cleaned by hand,
    -- including votes on the answers that are about to cascade away.
    delete from votes
     where (target_type = 'post' and target_id = p_id)
        or (target_type = 'answer'
            and target_id in (select id from answers where post_id = p_id));
    delete from reports
     where target_type = 'answer'
       and target_id in (select id from answers where post_id = p_id);
    delete from posts where id = p_id;   -- answers cascade
    get diagnostics n = row_count; removed := n;

  elsif p_target = 'answer' then
    delete from votes where target_type = 'answer' and target_id = p_id;
    delete from answers where id = p_id;
    get diagnostics n = row_count; removed := n;

  elsif p_target = 'message' then
    -- message_reactions cascade on the FK.
    delete from messages where id = p_id;
    get diagnostics n = row_count; removed := n;

  elsif p_target = 'listing' then
    delete from vouches where listing_id = p_id;
    delete from listings where id = p_id;
    get diagnostics n = row_count; removed := n;
  end if;

  return removed;
end $$;

grant execute on function admin_hard_delete(report_target, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Staff need to remove the underlying file too. Deleting only the
-- message row leaves the image reachable by anyone who has the URL.
-- ---------------------------------------------------------------------
drop policy if exists "staff can delete uploads" on storage.objects;
create policy "staff can delete uploads"
  on storage.objects for delete to authenticated
  using (bucket_id = 'uploads' and is_staff());

-- ---------------------------------------------------------------------
-- The queue needs image_url so the panel can delete the file alongside
-- the row.
-- ---------------------------------------------------------------------
drop function if exists mod_report_queue(report_status, integer);

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
           count(*)::integer                          as report_count,
           string_agg(distinct r.reason, ' · ')       as reasons,
           min(r.created_at)                          as first_reported,
           max(r.created_at)                          as last_reported,
           string_agg(distinct rp.display_name, ', ') as reporter_names,
           (array_agg(r.claimed_by order by r.claimed_at desc nulls last))[1] as claimed_by,
           (array_agg(r.claimed_at order by r.claimed_at desc nulls last))[1] as claimed_at
    from reports r
    left join profiles rp on rp.id = r.reporter_id
    where r.status = p_status
    group by r.target_type, r.target_id
  )
  select g.target_type,
         g.target_id,
         g.report_count,
         g.reasons,
         g.first_reported,
         g.last_reported,
         g.reporter_names,
         case g.target_type
           when 'post'    then p.author_id
           when 'answer'  then a.author_id
           when 'message' then m.author_id
           when 'listing' then l.submitted_by
           when 'profile' then tp.id
         end,
         case g.target_type
           when 'post'    then pa.display_name
           when 'answer'  then aa.display_name
           when 'message' then ma.display_name
           when 'listing' then la.display_name
           when 'profile' then tp.display_name
         end,
         case g.target_type
           when 'post'    then pa.role
           when 'answer'  then aa.role
           when 'message' then ma.role
           when 'listing' then la.role
           when 'profile' then tp.role
         end,
         case g.target_type
           when 'post'    then pa.is_banned
           when 'answer'  then aa.is_banned
           when 'message' then ma.is_banned
           when 'listing' then la.is_banned
           when 'profile' then tp.is_banned
         end,
         case g.target_type
           when 'post'    then left(coalesce(p.title,'') || ' — ' || coalesce(p.body,''), 300)
           when 'answer'  then left(coalesce(a.body,''), 300)
           when 'message' then left(coalesce(m.body,'') ||
                                    case when m.image_url is not null
                                         then ' [image]' else '' end, 300)
           when 'listing' then left(coalesce(l.name,'') || ' — ' || coalesce(l.description,''), 300)
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
           when 'profile' then tp.is_banned
         end,
         g.claimed_by,
         cb.display_name,
         (g.claimed_by is not null and g.claimed_at > now() - claim_ttl())
  from grouped g
  left join posts    p  on g.target_type = 'post'    and p.id  = g.target_id
  left join answers  a  on g.target_type = 'answer'  and a.id  = g.target_id
  left join messages m  on g.target_type = 'message' and m.id  = g.target_id
  left join listings l  on g.target_type = 'listing' and l.id  = g.target_id
  left join profiles tp on g.target_type = 'profile' and tp.id = g.target_id
  left join profiles pa on pa.id = p.author_id
  left join profiles aa on aa.id = a.author_id
  left join profiles ma on ma.id = m.author_id
  left join profiles la on la.id = l.submitted_by
  left join profiles cb on cb.id = g.claimed_by
  order by g.report_count desc, g.last_reported desc
  limit p_limit;
end $$;

grant execute on function mod_report_queue(report_status, integer) to authenticated;

commit;
