-- =====================================================================
-- WASIF LAY — 0002: restore service_role privileges
--
-- Context: `drop schema public cascade; create schema public;` destroys
-- the schema-level grants AND the ALTER DEFAULT PRIVILEGES rules that
-- Supabase configures at project creation. Migration 0001 explicitly
-- granted anon and authenticated, so the app worked — but service_role
-- was left with no access at all, which surfaces as:
--
--   42501: permission denied for table rooms
--
-- service_role is the trusted server-side key. It intentionally has
-- full access and bypasses RLS. The column-level restrictions on
-- anon/authenticated from 0001 are unaffected by anything below.
-- =====================================================================

begin;

-- Schema usage -------------------------------------------------------
grant usage on schema public to postgres, anon, authenticated, service_role;

-- Existing objects ---------------------------------------------------
grant all on all tables    in schema public to postgres, service_role;
grant all on all sequences in schema public to postgres, service_role;
grant all on all functions in schema public to postgres, service_role;

-- Future objects: this is what the schema drop actually destroyed.
-- Without it, every table created from here on repeats the same failure.
alter default privileges in schema public
  grant all on tables to postgres, service_role;
alter default privileges in schema public
  grant all on sequences to postgres, service_role;
alter default privileges in schema public
  grant all on functions to postgres, service_role;

-- Re-assert the anon/authenticated execute grants on the RPCs, since
-- `grant all on all functions` above does not narrow them.
grant execute on function search_all(text, text) to anon, authenticated;
grant execute on function is_staff()        to authenticated;
grant execute on function is_admin()        to authenticated;
grant execute on function is_active_user()  to authenticated;
grant execute on function mod_remove(report_target, uuid)        to authenticated;
grant execute on function mod_restore(report_target, uuid)       to authenticated;
grant execute on function mod_set_ban(uuid, boolean)             to authenticated;
grant execute on function mod_resolve_report(uuid, report_status) to authenticated;
grant execute on function admin_set_role(uuid, user_role)        to authenticated;

commit;

-- Verify:
--   set role service_role; select count(*) from rooms; reset role;
