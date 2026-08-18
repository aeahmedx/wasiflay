-- =====================================================================
-- WASIF LAY — 0004: real anonymity
--
-- Problem: RLS is row-level. `posts` and `answers` are readable by
-- everyone, and author_id is one of the readable columns. So anonymity
-- was cosmetic — the UI hid the name, but any client holding the public
-- anon key could select author_id and unmask every anonymous post.
--
-- That is the wrong failure for the exact content anonymity exists to
-- protect: immigration status, legal trouble, money, family.
--
-- Fix: revoke SELECT on author_id, and read through views that mask it.
-- A user still sees their OWN id on their own anonymous items, so
-- self-vote prevention keeps working.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Masking views
-- ---------------------------------------------------------------------
drop view if exists public_posts;

create view public_posts
with (security_invoker = false) as
  select p.id,
         case
           when not p.is_anonymous then p.author_id
           when p.author_id = auth.uid() then p.author_id  -- you know it's yours
           else null
         end as author_id,
         p.type,
         p.title,
         p.body,
         p.city,
         p.region,
         p.is_anonymous,
         p.answer_count,
         p.helpful_count,
         p.created_at
  from posts p
  where not p.is_removed;

drop view if exists public_answers;

create view public_answers
with (security_invoker = false) as
  select a.id,
         a.post_id,
         case
           when not a.is_anonymous then a.author_id
           when a.author_id = auth.uid() then a.author_id
           else null
         end as author_id,
         a.body,
         a.is_anonymous,
         a.helpful_count,
         a.created_at
  from answers a
  where not a.is_removed;

grant select on public_posts, public_answers to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Close the direct path
--    Re-grant every readable column EXCEPT author_id. Inserts are
--    unaffected: insert grants are separate from select grants, so a
--    user can still write their own author_id.
-- ---------------------------------------------------------------------
revoke select on posts, answers from anon, authenticated;

grant select (id, type, title, body, city, region, is_anonymous,
              answer_count, helpful_count, is_removed, created_at)
  on posts to anon, authenticated;

grant select (id, post_id, body, is_anonymous, helpful_count,
              is_removed, created_at)
  on answers to anon, authenticated;

commit;

-- Verify the hole is closed — this must now fail:
--   select author_id from posts;
-- And this must still work:
--   select author_id, title, is_anonymous from public_posts;
