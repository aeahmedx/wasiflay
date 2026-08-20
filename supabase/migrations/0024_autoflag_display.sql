-- =====================================================================
-- WASIF LAY — 0024: show automatic reports as automatic
--
-- 0023 made reporter_id nullable so the system can file reports. The
-- queue joins reporters by id, so those rows came back with an empty
-- reporter name — which reads as a bug rather than as "nobody reported
-- this, the platform noticed it".
-- =====================================================================

begin;

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
           -- A null reporter means the platform flagged it, not a person.
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
                                    case when m.image_url is not null then ' [image]' else '' end, 300)
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
         g.claimed_by, cb.display_name,
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
