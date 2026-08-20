-- =====================================================================
-- WASIF LAY — 0022: blocking, deletion, export, kill switch
--
-- Four things, all enforced in the database rather than the interface:
--
--   1. Blocking — mutual invisibility, applied inside the masking views
--      so every existing query inherits it with no code change.
--   2. Account deletion — anonymise, never cascade. Deleting a profile
--      row would take every post and answer with it and tear holes in
--      conversations other people took part in.
--   3. Data export — one call returning everything we hold about you.
--   4. Kill switch — one flag that makes the whole site read-only, for
--      the Saturday afternoon when something goes badly wrong and a
--      code deploy from a parking lot isn't an option.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Blocking
-- ---------------------------------------------------------------------
create table if not exists blocks (
  blocker_id uuid        not null references profiles(id) on delete cascade,
  blocked_id uuid        not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists idx_blocks_blocked on blocks (blocked_id);

alter table blocks enable row level security;

-- You can only ever see your own blocks. Whether someone blocked you is
-- not information you get — that turns a quiet exit into a confrontation.
drop policy if exists blocks_read_own on blocks;
create policy blocks_read_own on blocks
  for select using (auth.uid() = blocker_id);

drop policy if exists blocks_insert_own on blocks;
create policy blocks_insert_own on blocks
  for insert with check (auth.uid() = blocker_id);

drop policy if exists blocks_delete_own on blocks;
create policy blocks_delete_own on blocks
  for delete using (auth.uid() = blocker_id);

grant select on blocks to authenticated;
grant insert (blocker_id, blocked_id) on blocks to authenticated;
grant delete on blocks to authenticated;

/**
 * True when either person has blocked the other. Blocking is mutual in
 * effect: the blocker stops seeing them, and they stop seeing the
 * blocker — otherwise blocking someone hands them a list of posts to
 * follow you to.
 */
create or replace function blocked_with(p_other uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p_other)
       or (b.blocked_id = auth.uid() and b.blocker_id = p_other)
  );
$$;

grant execute on function blocked_with(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Masking views gain the block filter
--    Every existing query reads through these, so blocking applies
--    everywhere at once rather than being re-implemented per screen.
-- ---------------------------------------------------------------------
drop view if exists public_posts;

create view public_posts
with (security_invoker = false) as
  select p.id,
         case
           when not p.is_anonymous then p.author_id
           when p.author_id = auth.uid() then p.author_id
           else null
         end as author_id,
         p.type, p.title, p.body, p.city, p.region, p.is_anonymous,
         p.answer_count, p.helpful_count, p.created_at
  from posts p
  where not p.is_removed
    and not exists (
      select 1 from blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.author_id)
         or (b.blocked_id = auth.uid() and b.blocker_id = p.author_id)
    );

drop view if exists public_answers;

create view public_answers
with (security_invoker = false) as
  select a.id, a.post_id,
         case
           when not a.is_anonymous then a.author_id
           when a.author_id = auth.uid() then a.author_id
           else null
         end as author_id,
         a.body, a.is_anonymous, a.helpful_count, a.created_at
  from answers a
  where not a.is_removed
    and not exists (
      select 1 from blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = a.author_id)
         or (b.blocked_id = auth.uid() and b.blocker_id = a.author_id)
    );

create or replace view public_messages
with (security_invoker = false) as
  select m.id, m.room_id, m.author_id, m.body, m.image_url,
         m.image_width, m.image_height, m.edited_at, m.created_at
  from messages m
  where not m.is_removed
    and not exists (
      select 1 from blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = m.author_id)
         or (b.blocked_id = auth.uid() and b.blocker_id = m.author_id)
    );

grant select on public_posts, public_answers, public_messages
  to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Kill switch
-- ---------------------------------------------------------------------
create table if not exists site_settings (
  id         boolean primary key default true check (id),
  read_only  boolean not null default false,
  notice     text,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

insert into site_settings (id) values (true) on conflict (id) do nothing;

alter table site_settings enable row level security;

drop policy if exists site_settings_read on site_settings;
create policy site_settings_read on site_settings for select using (true);

grant select on site_settings to anon, authenticated;

create or replace function set_read_only(p_on boolean, p_notice text default null)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'ADMIN_ONLY' using errcode = 'P0001';
  end if;
  update site_settings
     set read_only = p_on,
         notice = p_notice,
         updated_by = auth.uid(),
         updated_at = now()
   where id;
end $$;

grant execute on function set_read_only(boolean, text) to authenticated;

/**
 * Every insert policy in the schema goes through this, so flipping
 * read_only stops all writes at once — posts, answers, votes, messages,
 * reactions, reports. Admins are exempt so moderation still works while
 * the site is frozen.
 */
create or replace function is_active_user()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
      select 1 from profiles
      where id = auth.uid() and not is_banned and deleted_at is null
    )
    and (
      not (select read_only from site_settings where id)
      or is_admin()
    );
$$;

-- ---------------------------------------------------------------------
-- 4. Account deletion
--
--    Anonymise, never cascade. profiles.id is the parent of every post,
--    answer and message, so deleting the row would delete other
--    people's conversations along with it.
-- ---------------------------------------------------------------------
alter table profiles add column if not exists deleted_at timestamptz;

grant select (deleted_at) on profiles to authenticated;

create or replace function delete_own_account()
returns void
language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid();
begin
  if me is null then
    raise exception 'NOT_SIGNED_IN' using errcode = 'P0001';
  end if;

  update profiles
     set display_name = 'Deleted member',
         city = null,
         country_flag = null,
         show_city = false,
         sms_opt_in = false,
         deleted_at = now()
   where id = me;

  -- Their own blocks go; blocks against them stay, so someone who
  -- blocked a harasser isn't quietly re-exposed if the account returns.
  delete from blocks where blocker_id = me;

  -- Anonymous posts stay anonymous; named ones now read "Deleted member".
end $$;

grant execute on function delete_own_account() to authenticated;

-- A deleted account must not appear anywhere or be able to act.
drop view if exists public_profiles;

create view public_profiles
with (security_invoker = false) as
  select p.id, p.display_name, p.country_flag, p.role, p.region,
         p.contribution_count, p.helpful_count, p.created_at,
         case
           when p.id = auth.uid() then p.city
           when p.is_minor then null
           when not p.show_city then null
           else p.city
         end as city,
         (p.id = auth.uid()) as is_self,
         case when p.id = auth.uid() then p.is_banned         else false end as is_banned,
         case when p.id = auth.uid() then p.sms_opt_in        else false end as sms_opt_in,
         case when p.id = auth.uid() then p.is_minor          else false end as is_minor,
         case when p.id = auth.uid() then p.terms_version     else null  end as terms_version,
         case when p.id = auth.uid() then p.terms_accepted_at else null  end as terms_accepted_at
  from profiles p
  where (not p.is_banned or p.id = auth.uid())
    and p.deleted_at is null
    and not exists (
      select 1 from blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
         or (b.blocked_id = auth.uid() and b.blocker_id = p.id)
    );

grant select on public_profiles to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Data export
-- ---------------------------------------------------------------------
create or replace function export_my_data()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare me uuid := auth.uid();
begin
  if me is null then
    raise exception 'NOT_SIGNED_IN' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'exported_at', now(),
    'profile', (
      select to_jsonb(x) from (
        select display_name, city, region, country_flag, date_of_birth,
               contribution_count, helpful_count, created_at,
               terms_version, terms_accepted_at, sms_opt_in
        from profiles where id = me
      ) x
    ),
    'posts', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select title, body, type, region, is_anonymous, created_at, is_removed
        from posts where author_id = me order by created_at
      ) x
    ), '[]'::jsonb),
    'answers', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select body, is_anonymous, helpful_count, created_at, is_removed
        from answers where author_id = me order by created_at
      ) x
    ), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select body, image_url, created_at, is_removed
        from messages where author_id = me order by created_at
      ) x
    ), '[]'::jsonb),
    'reactions', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select emoji, created_at from message_reactions where user_id = me
      ) x
    ), '[]'::jsonb),
    'reports_you_made', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select target_type, reason, status, created_at
        from reports where reporter_id = me order by created_at
      ) x
    ), '[]'::jsonb),
    'blocks', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select blocked_id, created_at from blocks where blocker_id = me
      ) x
    ), '[]'::jsonb)
  );
end $$;

grant execute on function export_my_data() to authenticated;

commit;
