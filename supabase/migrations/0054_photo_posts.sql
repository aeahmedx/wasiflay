-- =====================================================================
-- WASIF LAY — 0054: photo posts
--
-- A photo with no title. Posting a picture from the sideline should
-- take one tap and a file, not a title, a body and a category — that
-- friction is why the photos end up in WhatsApp instead.
--
-- Three changes, and no more:
--
--   1. title becomes optional, but only when there is an image. A post
--      with neither a title nor a photo is nothing at all, so the
--      constraint below still refuses it.
--
--   2. 'photo' joins the post_type enum. Without it a photo would be
--      filed as a question or an announcement and carry a badge that
--      lies about what it is.
--
--   3. The view is recreated to expose title as nullable. It already
--      selects p.title, so nothing changes in its shape — but the
--      anonymity masking and the is_removed filter are carried across
--      unchanged, because dropping either would expose who wrote an
--      anonymous post.
--
-- search_tsv already wraps title in coalesce, so a null title indexes
-- as an empty string rather than breaking the generated column.
-- =====================================================================

begin;

alter type post_type add value if not exists 'photo';

commit;

-- A new enum value cannot be used in the same transaction that adds it,
-- so the rest runs separately.
begin;

alter table posts alter column title drop not null;

alter table posts drop constraint if exists posts_title_check;

alter table posts
  add constraint posts_title_length
  check (
    title is null
    or char_length(trim(title)) between 5 and 200
  );

alter table posts drop constraint if exists posts_body_or_image;

alter table posts
  add constraint posts_has_something
  check (
    char_length(trim(coalesce(title, ''))) > 0
    or char_length(trim(coalesce(body, ''))) > 0
    or image_url is not null
  );

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
         p.answer_count, p.helpful_count, p.event_id, p.created_at,
         p.image_url, p.image_width, p.image_height
  from posts p
  where not p.is_removed
    and not exists (
      select 1 from blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.author_id)
         or (b.blocked_id = auth.uid() and b.blocker_id = p.author_id)
    );

grant select on public_posts to anon, authenticated;

commit;

-- Check:
--   select unnest(enum_range(null::post_type));
--   select is_nullable from information_schema.columns
--    where table_name = 'posts' and column_name = 'title';
--
-- Expect 'photo' in the enum and title nullable.
