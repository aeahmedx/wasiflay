-- =====================================================================
-- WASIF LAY — 0021: terms acceptance
--
-- Records that a person accepted the current terms, and which version.
-- Versioned rather than a boolean: when the terms change materially,
-- bumping the version re-prompts everyone, and there is a record of what
-- each person actually agreed to.
--
-- is_minor is exposed for the viewer's own row so the gate can show the
-- parental-consent line to the people it applies to. Other people's
-- ages stay private, same rule as is_banned.
-- =====================================================================

begin;

alter table profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version     text;

-- New columns get no grants from the column-level grants in 0001.
grant select (terms_accepted_at, terms_version) on profiles to authenticated;
grant update (terms_accepted_at, terms_version) on profiles to authenticated;

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
         case when p.id = auth.uid() then p.is_banned        else false end as is_banned,
         case when p.id = auth.uid() then p.sms_opt_in       else false end as sms_opt_in,
         case when p.id = auth.uid() then p.is_minor         else false end as is_minor,
         case when p.id = auth.uid() then p.terms_version    else null  end as terms_version,
         case when p.id = auth.uid() then p.terms_accepted_at else null end as terms_accepted_at
  from profiles p
  where not p.is_banned or p.id = auth.uid();

grant select on public_profiles to anon, authenticated;

commit;
