-- =====================================================================
-- WASIF LAY — 0013: ban hierarchy
--
-- Admins were already protected from being banned. Two adjacent holes
-- remained:
--
--   * A moderator could ban themselves — one mis-tap and they're locked
--     out mid-event with no way back except another staff member.
--   * A moderator could ban another moderator, so one compromised or
--     careless mod account could disable the whole moderation team
--     during the exact hours it matters.
--
-- Rules: nobody bans an admin, nobody bans themselves, and only an admin
-- can ban a moderator. The same hierarchy applies to purging content.
-- =====================================================================

begin;

create or replace function mod_set_ban(p_user uuid, p_banned boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare target_role user_role;
begin
  if not is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if p_user = auth.uid() then
    raise exception 'CANNOT_BAN_SELF' using errcode = 'P0001';
  end if;

  select role into target_role from profiles where id = p_user;

  if target_role is null then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0001';
  end if;

  if target_role = 'admin' then
    raise exception 'CANNOT_BAN_ADMIN' using errcode = 'P0001';
  end if;

  -- Only an admin may act on a moderator.
  if target_role = 'moderator' and not is_admin() then
    raise exception 'CANNOT_BAN_MODERATOR' using errcode = 'P0001';
  end if;

  update profiles set is_banned = p_banned where id = p_user;
end $$;

create or replace function mod_purge_user(p_user uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare affected integer := 0;
        n integer;
        target_role user_role;
begin
  if not is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if p_user = auth.uid() then
    raise exception 'CANNOT_PURGE_SELF' using errcode = 'P0001';
  end if;

  select role into target_role from profiles where id = p_user;

  if target_role = 'admin' then
    raise exception 'CANNOT_PURGE_ADMIN' using errcode = 'P0001';
  end if;

  if target_role = 'moderator' and not is_admin() then
    raise exception 'CANNOT_PURGE_MODERATOR' using errcode = 'P0001';
  end if;

  update posts set is_removed = true, removed_by = auth.uid()
  where author_id = p_user and not is_removed;
  get diagnostics n = row_count; affected := affected + n;

  update answers set is_removed = true, removed_by = auth.uid()
  where author_id = p_user and not is_removed;
  get diagnostics n = row_count; affected := affected + n;

  update messages set is_removed = true, removed_by = auth.uid()
  where author_id = p_user and not is_removed;
  get diagnostics n = row_count; affected := affected + n;

  return affected;
end $$;

-- ---------------------------------------------------------------------
-- The report queue needs the author's role so the UI can disable a Ban
-- button it knows will be refused, rather than showing an error after
-- the tap.
-- ---------------------------------------------------------------------
drop function if exists mod_report_queue(report_status, integer);

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
  author_role   user_role,
  preview       text,
  is_anonymous  boolean,
  is_removed    boolean,
  author_banned boolean
)
language plpgsql stable security definer set search_path = public
as $$
#variable_conflict use_column
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
           when 'post'    then pa.role
           when 'answer'  then aa.role
           when 'message' then ma.role
           when 'listing' then la.role
           when 'profile' then tp.role
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

commit;
