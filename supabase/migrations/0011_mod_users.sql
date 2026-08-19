-- =====================================================================
-- WASIF LAY — 0011: moderate users directly
--
-- Reports are reactive: they require someone to have already posted
-- something. Staff also need to act on a person — a known bad actor, a
-- repeat offender whose content was already removed, an account
-- impersonating someone.
--
-- public_profiles deliberately hides other people's ban status and drops
-- banned accounts entirely, so staff need a privileged lookup.
-- =====================================================================

begin;

create or replace function mod_find_users(
  p_query       text    default '',
  p_banned_only boolean default false,
  p_limit       integer default 50
)
returns table (
  id                 uuid,
  display_name       text,
  region             text,
  city               text,
  country_flag       text,
  role               user_role,
  is_banned          boolean,
  is_minor           boolean,
  contribution_count integer,
  helpful_count      integer,
  joined_at          timestamptz,
  open_reports       integer
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  return query
  select p.id,
         p.display_name,
         p.region,
         p.city,
         p.country_flag,
         p.role,
         p.is_banned,
         p.is_minor,
         p.contribution_count,
         p.helpful_count,
         p.created_at,
         (
           -- reports against this person's content or profile
           select count(*)::integer
           from reports r
           where r.status = 'open'
             and (
               (r.target_type = 'profile' and r.target_id = p.id)
               or (r.target_type = 'post'    and r.target_id in (select id from posts    where author_id = p.id))
               or (r.target_type = 'answer'  and r.target_id in (select id from answers  where author_id = p.id))
               or (r.target_type = 'message' and r.target_id in (select id from messages where author_id = p.id))
             )
         )
  from profiles p
  where (not p_banned_only or p.is_banned)
    and (
      coalesce(trim(p_query), '') = ''
      or p.display_name ilike '%' || p_query || '%'
      or p.city         ilike '%' || p_query || '%'
    )
  order by p.is_banned desc, p.created_at desc
  limit p_limit;
end $$;

grant execute on function mod_find_users(text, boolean, integer)
  to authenticated;

-- ---------------------------------------------------------------------
-- Removing everything a person posted, in one action. Useful when an
-- account turns out to be a spammer mid-event and you don't want to
-- work through their history item by item.
-- ---------------------------------------------------------------------
create or replace function mod_purge_user(p_user uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare affected integer := 0;
        n integer;
begin
  if not is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if exists (select 1 from profiles where id = p_user and role = 'admin') then
    raise exception 'CANNOT_PURGE_ADMIN' using errcode = 'P0001';
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

grant execute on function mod_purge_user(uuid) to authenticated;

commit;
