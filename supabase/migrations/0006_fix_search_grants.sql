-- =====================================================================
-- WASIF LAY — 0006: fix search
--
-- 0004 revoked SELECT on posts and re-granted an explicit column list to
-- close the author_id leak. That list covered the display columns but
-- omitted search_tsv.
--
-- search_all() is SECURITY INVOKER, so it runs as the calling user and
-- reads posts.search_tsv directly. Without the grant every search fails
-- with permission denied, which surfaces in the UI as "Search isn't
-- responding".
--
-- search_tsv is a derived tsvector of title + body, both already
-- readable. Granting it exposes nothing new.
-- =====================================================================

begin;

grant select (search_tsv) on posts to anon, authenticated;

-- listings was never revoked, but grant it explicitly so a future
-- revoke-and-regrant on that table can't reintroduce the same bug.
grant select (search_tsv) on listings to anon, authenticated;

commit;

-- Verify (as an ordinary user, not the SQL editor's superuser):
--   select * from search_all('chrome');
