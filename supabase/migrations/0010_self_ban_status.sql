-- =====================================================================
-- WASIF LAY — 0010: self-visible ban status
--
-- A banned account currently fails silently: is_active_user() returns
-- false, every insert policy rejects the write, and the user sees a
-- generic "couldn't send" with no explanation. That reads as a broken
-- app rather than a moderation decision.
--
-- Expose is_banned on the viewer's OWN row only. Other people's ban
-- status stays private — banned profiles already drop out of the view
-- entirely for everyone else.
-- =====================================================================

begin;

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
         -- own status only; never leaks another account's
         case when p.id = auth.uid() then p.is_banned else false end
           as is_banned
  from profiles p
  where not p.is_banned or p.id = auth.uid();

grant select on public_profiles to anon, authenticated;

commit;
