-- =====================================================================
-- WASIF LAY — 0018: notifications
--
-- Rows have been accumulating since posts shipped and nothing reads
-- them. This is the retention loop: someone asks, someone answers, the
-- asker comes back.
--
-- Privacy note that drove the design: if an answer was posted
-- anonymously, the notification must not name the author. Otherwise
-- notifications become a side channel that unmasks every anonymous
-- answer to the one person most motivated to find out who wrote it.
--
-- Phone numbers live in auth.users, not in profiles. Nothing in the app
-- can read them; only the server-side send job does, through the
-- service role.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. SMS opt-in
--    Separate from having a phone: someone can verify a number and
--    later switch texts off without losing the number.
-- ---------------------------------------------------------------------
alter table profiles add column if not exists sms_opt_in boolean not null default false;

grant select (sms_opt_in) on profiles to authenticated;
grant update (sms_opt_in) on profiles to authenticated;

-- Own status only, same rule as is_banned.
drop view if exists public_profiles;

create view public_profiles
with (security_invoker = false) as
  select p.id,
         p.display_name,
         p.country_flag,
         p.role,
         p.region,
         p.contribution_count,
         p.helpful_count,
         p.created_at,
         case
           when p.id = auth.uid() then p.city
           when p.is_minor then null
           when not p.show_city then null
           else p.city
         end as city,
         (p.id = auth.uid()) as is_self,
         case when p.id = auth.uid() then p.is_banned  else false end as is_banned,
         case when p.id = auth.uid() then p.sms_opt_in else false end as sms_opt_in
  from profiles p
  where not p.is_banned or p.id = auth.uid();

grant select on public_profiles to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Reading your notifications
-- ---------------------------------------------------------------------
create or replace function my_notifications(p_limit integer default 50)
returns table (
  id           uuid,
  kind         text,
  post_id      uuid,
  post_title   text,
  answer_id    uuid,
  actor_name   text,
  is_anonymous boolean,
  is_read      boolean,
  created_at   timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then
    raise exception 'NOT_SIGNED_IN' using errcode = 'P0001';
  end if;

  return query
  select n.id,
         n.kind,
         n.post_id,
         p.title,
         n.answer_id,
         -- Never name the author of an anonymous answer. The person
         -- being notified is the one most motivated to find out.
         case
           when a.is_anonymous then 'Anonymous'
           else coalesce(ap.display_name, 'Someone')
         end,
         coalesce(a.is_anonymous, false),
         n.is_read,
         n.created_at
  from notifications n
  left join posts    p  on p.id = n.post_id
  left join answers  a  on a.id = n.answer_id
  left join profiles ap on ap.id = n.actor_id
  where n.user_id = auth.uid()
    -- Don't notify about content that has since been removed.
    and (n.answer_id is null or a.is_removed = false)
    and (n.post_id is null   or p.is_removed = false)
  order by n.created_at desc
  limit p_limit;
end $$;

grant execute on function my_notifications(integer) to authenticated;

create or replace function my_unread_count()
returns integer
language sql stable security definer set search_path = public
as $$
  select case
    when auth.uid() is null then 0
    else (
      select count(*)::integer
      from notifications n
      left join answers a on a.id = n.answer_id
      left join posts   p on p.id = n.post_id
      where n.user_id = auth.uid()
        and not n.is_read
        and (n.answer_id is null or a.is_removed = false)
        and (n.post_id is null   or p.is_removed = false)
    )
  end;
$$;

grant execute on function my_unread_count() to authenticated;

create or replace function mark_notifications_read(p_ids uuid[] default null)
returns integer
language plpgsql security definer set search_path = public
as $$
declare affected integer;
begin
  if auth.uid() is null then
    raise exception 'NOT_SIGNED_IN' using errcode = 'P0001';
  end if;

  update notifications
     set is_read = true
   where user_id = auth.uid()
     and not is_read
     and (p_ids is null or id = any(p_ids));

  get diagnostics affected = row_count;
  return affected;
end $$;

grant execute on function mark_notifications_read(uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- 3. The SMS send queue
--    Service-role only. Returns unsent notifications for people who
--    opted in and have a confirmed number, with the phone attached.
-- ---------------------------------------------------------------------
create or replace function pending_sms(p_limit integer default 100)
returns table (
  notification_id uuid,
  phone           text,
  post_id         uuid,
  post_title      text
)
language sql stable security definer set search_path = public
as $$
  select n.id,
         u.phone,
         n.post_id,
         p.title
  from notifications n
  join profiles  pr on pr.id = n.user_id
  join auth.users u on u.id = n.user_id
  left join posts   p on p.id = n.post_id
  left join answers a on a.id = n.answer_id
  where n.sms_sent_at is null
    and not n.is_read
    and pr.sms_opt_in
    and not pr.is_banned
    and u.phone is not null
    and u.phone_confirmed_at is not null
    and (n.answer_id is null or a.is_removed = false)
    and (n.post_id is null   or p.is_removed = false)
    -- Don't text about something that happened hours ago.
    and n.created_at > now() - interval '6 hours'
  order by n.created_at
  limit p_limit;
$$;

revoke all on function pending_sms(integer) from anon, authenticated;

create or replace function mark_sms_sent(p_ids uuid[])
returns integer
language plpgsql security definer set search_path = public
as $$
declare affected integer;
begin
  update notifications set sms_sent_at = now() where id = any(p_ids);
  get diagnostics affected = row_count;
  return affected;
end $$;

revoke all on function mark_sms_sent(uuid[]) from anon, authenticated;

commit;
