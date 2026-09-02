-- =====================================================================
-- WASIF LAY — 0049: region is optional again
--
-- 0003 backfilled a region for everyone and made the column NOT NULL.
-- That was right when onboarding asked for one. It no longer does —
-- region filtering is off for launch, and every field on that screen
-- was a place to abandon a sign-up that had already been agreed to.
--
-- Every view that selects p.region passes it straight through, and
-- regionName() already returns an empty string for null, so nothing
-- downstream needs changing. The constraint is the only blocker.
--
-- Reversing this means backfilling a region for anyone who joined
-- without one before re-adding the constraint.
-- =====================================================================

begin;

alter table profiles alter column region drop not null;

commit;

-- Check:
--   select column_name, is_nullable
--     from information_schema.columns
--    where table_name = 'profiles' and column_name = 'region';
--
-- Expect: region | YES
