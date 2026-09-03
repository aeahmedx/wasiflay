-- =====================================================================
-- WASIF LAY — 0050: promo_code needs a grant
--
-- 0048 added the column but not the permission. This schema uses
-- column-level grants on profiles — writes are restricted to the exact
-- fields a person legitimately authors — so a new column is invisible
-- to inserts until it is named here. The failure surfaces as
-- "permission denied for table profiles", which points at the table
-- rather than the column and is easy to misread.
--
-- Insert only. Nobody should be able to change which card brought them
-- after the fact, so there is deliberately no update grant.
--
-- Select is granted so someone can see their own attribution; the
-- dashboard doesn't need it, since those functions are SECURITY
-- DEFINER and bypass column grants entirely.
-- =====================================================================

begin;

grant insert (promo_code) on profiles to authenticated;
grant select (promo_code) on profiles to authenticated;

commit;

-- Check the full insert grant list:
--   select string_agg(column_name, ', ' order by column_name)
--     from information_schema.column_privileges
--    where table_name = 'profiles'
--      and privilege_type = 'INSERT'
--      and grantee = 'authenticated';
--
-- Expect: city, country_flag, date_of_birth, display_name, id,
--         promo_code, region
