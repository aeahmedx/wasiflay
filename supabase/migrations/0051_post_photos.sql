-- =====================================================================
-- WASIF LAY — 0051: photos on posts
--
-- Mirrors what messages have had since 0001 and 0009: a public URL plus
-- the dimensions, so the feed reserves the right space before the image
-- arrives instead of reflowing as it loads.
--
-- The storage bucket, its upload policy and the delete policy already
-- exist and are shared with room photos, so nothing here touches
-- storage. Only the columns, their grants, and the view are new.
--
-- public_posts is recreated exactly as 0027 left it, plus three
-- columns. The anonymity masking on author_id and the is_removed filter
-- are carried over unchanged — dropping either would expose who wrote
-- an anonymous post, which is the one thing this app promises not to do.
-- =====================================================================

begin;

alter table posts
  add column if not exists image_url    text,
  add column if not exists image_width  integer,
  add column if not exists image_height integer;

-- Column grants are the part that is easy to miss on this schema:
-- writes to posts are restricted to the exact fields a person authors,
-- so a new column is invisible to inserts until it is named here.
grant select (image_url, image_width, image_height) on posts to anon, authenticated;
grant insert (image_url, image_width, image_height) on posts to authenticated;

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

-- ---------------------------------------------------------------------
-- Storage
--
-- The bucket and its delete policy already exist. The upload policy was
-- created outside migrations, so its path rules are not visible here —
-- rather than assume a new prefix is allowed, this adds an explicit one
-- for post photos.
--
-- Policies combine with OR, so if an upload policy already covers this
-- path, nothing changes. If it does not, this is what makes the upload
-- work. Either way the file must sit under posts/<your own id>/, so
-- nobody can write into someone else's folder.
-- ---------------------------------------------------------------------
drop policy if exists "upload own post photos" on storage.objects;

create policy "upload own post photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = 'posts'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- Check:
--   select column_name from information_schema.columns
--    where table_name = 'public_posts' and column_name like 'image%';
--
--   select string_agg(column_name, ', ' order by column_name)
--     from information_schema.column_privileges
--    where table_name = 'posts' and privilege_type = 'INSERT'
--      and grantee = 'authenticated';
--
-- Expect the three image columns in both.
