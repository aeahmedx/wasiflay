-- =====================================================================
-- WASIF LAY — 0019: activity
--
-- Broadens notifications beyond "someone answered you", while keeping
-- SMS to that one event. Texts are a limited budget of attention; the
-- in-app feed can carry more.
--
-- Added:
--   helpful_received — someone marked your answer or post helpful
--   content_removed  — a moderator removed something you wrote
--
-- Deliberately NOT added: chat reactions. A busy room would generate
-- hundreds and drown the notifications that matter.
--
-- Two anonymity rules baked in:
--   * helpful votes never name the voter — naming turns votes into a
--     social ledger and invites reciprocal voting
--   * removals never name the moderator — protects volunteers from
--     being cornered about a decision at an event
-- =====================================================================

begin;

alter table notifications
  add column if not exists message_id uuid references messages(id) on delete cascade;

create index if not exists idx_notifications_dedupe
  on notifications (user_id, kind, answer_id, post_id) where not is_read;

-- ---------------------------------------------------------------------
-- helpful_received
-- ---------------------------------------------------------------------
create or replace function notify_helpful()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
        p_id  uuid;
        a_id  uuid;
begin
  if new.target_type = 'answer' then
    select author_id, id into owner, a_id from answers
     where id = new.target_id and not is_removed;
    select post_id into p_id from answers where id = new.target_id;
  else
    select author_id, id into owner, p_id from posts
     where id = new.target_id and not is_removed;
  end if;

  if owner is null or owner = new.voter_id then
    return null;                      -- gone, or you voted on your own
  end if;

  -- One unread notification per item. Ten people finding the same answer
  -- helpful is one piece of news, not ten.
  if exists (
    select 1 from notifications
     where user_id = owner
       and kind = 'helpful_received'
       and not is_read
       and coalesce(answer_id, post_id) = coalesce(a_id, p_id)
  ) then
    return null;
  end if;

  insert into notifications (user_id, kind, post_id, answer_id, actor_id)
  values (owner, 'helpful_received', p_id, a_id, null);  -- actor withheld

  return null;
end $$;

drop trigger if exists t_votes_notify on votes;
create trigger t_votes_notify after insert on votes
  for each row execute function notify_helpful();

-- ---------------------------------------------------------------------
-- content_removed
--    Only moderator removals. Self-deletion leaves removed_by null and
--    obviously needs no notification.
-- ---------------------------------------------------------------------
create or replace function notify_removal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_removed and not coalesce(old.is_removed, false)
     and new.removed_by is not null
     and new.removed_by <> new.author_id then

    insert into notifications (user_id, kind, post_id, answer_id, message_id, actor_id)
    values (
      new.author_id,
      'content_removed',
      case when tg_table_name = 'posts'    then new.id else null end,
      case when tg_table_name = 'answers'  then new.id else null end,
      case when tg_table_name = 'messages' then new.id else null end,
      null                              -- moderator withheld
    );
  end if;
  return null;
end $$;

drop trigger if exists t_posts_removal_notify on posts;
create trigger t_posts_removal_notify after update of is_removed on posts
  for each row execute function notify_removal();

drop trigger if exists t_answers_removal_notify on answers;
create trigger t_answers_removal_notify after update of is_removed on answers
  for each row execute function notify_removal();

drop trigger if exists t_messages_removal_notify on messages;
create trigger t_messages_removal_notify after update of is_removed on messages
  for each row execute function notify_removal();

-- ---------------------------------------------------------------------
-- Reading the feed
-- ---------------------------------------------------------------------
create or replace function my_notifications(p_limit integer default 50)
returns table (
  id           uuid,
  kind         text,
  post_id      uuid,
  post_title   text,
  answer_id    uuid,
  message_id   uuid,
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
         n.message_id,
         case
           when n.kind <> 'answer_received' then null       -- no actor shown
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
    -- A removal notification is ABOUT removed content, so it must not be
    -- filtered by the same rule that hides stale answer notifications.
    and (
      n.kind = 'content_removed'
      or (
        (n.answer_id is null or a.is_removed = false)
        and (n.post_id is null or p.is_removed = false)
      )
    )
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
        and (
          n.kind = 'content_removed'
          or (
            (n.answer_id is null or a.is_removed = false)
            and (n.post_id is null or p.is_removed = false)
          )
        )
    )
  end;
$$;

grant execute on function my_unread_count() to authenticated;

-- ---------------------------------------------------------------------
-- SMS stays scoped to answers only
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
  select n.id, u.phone, n.post_id, p.title
  from notifications n
  join profiles  pr on pr.id = n.user_id
  join auth.users u on u.id = n.user_id
  left join posts   p on p.id = n.post_id
  left join answers a on a.id = n.answer_id
  where n.sms_sent_at is null
    and n.kind = 'answer_received'        -- texts only for answers
    and not n.is_read
    and pr.sms_opt_in
    and not pr.is_banned
    and u.phone is not null
    and u.phone_confirmed_at is not null
    and (n.answer_id is null or a.is_removed = false)
    and (n.post_id is null   or p.is_removed = false)
    and n.created_at > now() - interval '6 hours'
  order by n.created_at
  limit p_limit;
$$;

revoke all on function pending_sms(integer) from anon, authenticated;

commit;
