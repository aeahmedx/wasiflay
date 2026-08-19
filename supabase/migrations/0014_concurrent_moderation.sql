-- =====================================================================
-- WASIF LAY — 0014: concurrent moderation
--
-- The queue was built for one moderator working alone. With three people
-- on shift during an event it breaks in three ways:
--
--   1. Twelve people reporting one bad message produced twelve queue
--      entries. At an event that's most of the volume.
--   2. Nothing stopped two moderators working the same report at the
--      same time and reaching different conclusions.
--   3. The list only refreshed after you acted, so everyone was looking
--      at a stale queue.
--
-- Fixes: group by target, allow claiming with an expiry, and publish
-- reports over realtime so every panel stays current.
-- =====================================================================

begin;

alter table reports add column if not exists claimed_by uuid references profiles(id);
alter table reports add column if not exists claimed_at timestamptz;

create index if not exists idx_reports_target
  on reports (target_type, target_id, status);

-- A claim older than this is treated as abandoned. Someone locking their
-- phone must not hold a report hostage during an event.
create or replace function claim_ttl() returns interval
language sql immutable as $$ select interval '10 minutes' $$;

-- ---------------------------------------------------------------------
-- Grouped queue: one row per reported thing, not per report.
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

-- ---------------------------------------------------------------------
-- Claiming. Atomic: the UPDATE's WHERE clause is the lock, so two
-- moderators tapping at once cannot both win.
-- ---------------------------------------------------------------------
create or replace function mod_claim_target(
  p_target report_target,
  p_id     uuid
)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare updated integer;
begin
  if not is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  update reports
     set claimed_by = auth.uid(), claimed_at = now()
   where target_type = p_target
     and target_id = p_id
     and status = 'open'
     and (
       claimed_by is null
       or claimed_by = auth.uid()
       or claimed_at < now() - claim_ttl()   -- abandoned
     );

  get diagnostics updated = row_count;
  return updated > 0;
end $$;

grant execute on function mod_claim_target(report_target, uuid) to authenticated;

create or replace function mod_release_target(
  p_target report_target,
  p_id     uuid
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  update reports
     set claimed_by = null, claimed_at = null
   where target_type = p_target
     and target_id = p_id
     and status = 'open'
     and (claimed_by = auth.uid() or is_admin());
end $$;

grant execute on function mod_release_target(report_target, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Resolve every report against a target at once. Twelve reports on one
-- message is one decision, not twelve.
-- ---------------------------------------------------------------------
create or replace function mod_resolve_target(
  p_target report_target,
  p_id     uuid,
  p_status report_status
)
returns integer
language plpgsql security definer set search_path = public
as $$
declare affected integer;
begin
  if not is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  update reports
     set status = p_status,
         handled_by = auth.uid(),
         handled_at = now(),
         claimed_by = null,
         claimed_at = null
   where target_type = p_target
     and target_id = p_id
     and status = 'open';

  get diagnostics affected = row_count;
  return affected;
end $$;

grant execute on function mod_resolve_target(report_target, uuid, report_status)
  to authenticated;

-- Count distinct reported things, not raw report rows.
create or replace function mod_open_report_count()
returns integer
language sql stable security definer set search_path = public
as $$
  select case
    when is_staff() then (
      select count(*)::integer
      from (
        select 1 from reports where status = 'open'
        group by target_type, target_id
      ) t
    )
    else 0
  end;
$$;

grant execute on function mod_open_report_count() to authenticated;

-- ---------------------------------------------------------------------
-- Realtime so every open panel stays current without reloading.
-- ---------------------------------------------------------------------
alter table reports replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table reports;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

commit;
