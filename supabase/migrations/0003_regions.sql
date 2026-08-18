-- =====================================================================
-- WASIF LAY — 0003: regions
--
-- Free-text city fragments the community. "Philadelphia" and
-- "Conshohocken" are the same community; "Newark" and "New York" are the
-- same community; a typo is its own empty feed. Region is a fixed,
-- foreign-keyed list and is the ONLY thing the feed and search filter on.
--
-- `city` survives as optional display text (a profile can read
-- "Conshohocken" while filtering on Philadelphia Metro). It is never
-- used as a filter again.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Region list
-- ---------------------------------------------------------------------
create table if not exists regions (
  slug       text primary key,
  name       text not null,
  sort_order integer not null default 100,
  is_active  boolean not null default true
);

insert into regions (slug, name, sort_order) values
  ('philadelphia', 'Philadelphia Metro',            10),
  ('new-york',     'New York Metro',                20),
  ('dmv',          'DC / Maryland / Virginia',      30),
  ('boston',       'Boston',                        40),
  ('columbus',     'Columbus OH',                   50),
  ('detroit',      'Detroit',                       60),
  ('nashville',    'Nashville',                     70),
  ('atlanta',      'Atlanta',                       80),
  ('dallas',       'Dallas–Fort Worth',             90),
  ('houston',      'Houston',                      100),
  ('denver',       'Denver',                       110),
  ('phoenix',      'Phoenix',                      120),
  ('los-angeles',  'Los Angeles',                  130),
  ('bay-area',     'Bay Area',                     140),
  ('seattle',      'Seattle',                      150),
  ('minneapolis',  'Minneapolis',                  160),
  ('omaha',        'Omaha',                        170),
  ('kansas-city',  'Kansas City',                  180),
  ('toronto',      'Toronto',                      190),
  ('london',       'London',                       200),
  ('cairo',        'Cairo',                        210),
  ('khartoum',     'Khartoum',                     220),
  ('gulf',         'Gulf (UAE / Saudi / Qatar)',   230),
  ('other',        'Somewhere else',               999)
on conflict (slug) do nothing;

alter table regions enable row level security;

drop policy if exists regions_read on regions;
create policy regions_read on regions for select using (true);

-- ---------------------------------------------------------------------
-- 2. Columns
-- ---------------------------------------------------------------------
alter table profiles add column if not exists region text references regions(slug);
alter table posts    add column if not exists region text references regions(slug);
alter table listings add column if not exists region text references regions(slug);

-- ---------------------------------------------------------------------
-- 3. Backfill
--    Existing free-text cities are mapped where recognisable; anything
--    else lands in 'other' and the user re-picks.
-- ---------------------------------------------------------------------
update profiles set region = case
  when city ilike any (array['%philadelphia%','%conshohocken%','%camden%','%norristown%','%upper darby%','%king of prussia%']) then 'philadelphia'
  when city ilike any (array['%new york%','%newark%','%brooklyn%','%queens%','%bronx%','%jersey city%','%middletown%','%yonkers%']) then 'new-york'
  when city ilike any (array['%washington%','%arlington%','%alexandria%','%silver spring%','%baltimore%','%fairfax%','%maryland%','%virginia%']) then 'dmv'
  when city ilike '%boston%'      then 'boston'
  when city ilike '%columbus%'    then 'columbus'
  when city ilike '%detroit%'     then 'detroit'
  when city ilike '%nashville%'   then 'nashville'
  when city ilike '%atlanta%'     then 'atlanta'
  when city ilike any (array['%dallas%','%fort worth%','%arlington tx%']) then 'dallas'
  when city ilike '%houston%'     then 'houston'
  when city ilike '%denver%'      then 'denver'
  when city ilike '%phoenix%'     then 'phoenix'
  when city ilike any (array['%los angeles%','%anaheim%','%long beach%']) then 'los-angeles'
  when city ilike any (array['%san francisco%','%oakland%','%san jose%','%bay area%']) then 'bay-area'
  when city ilike '%seattle%'     then 'seattle'
  when city ilike any (array['%minneapolis%','%st paul%','%saint paul%']) then 'minneapolis'
  when city ilike '%omaha%'       then 'omaha'
  when city ilike '%kansas city%' then 'kansas-city'
  when city ilike '%toronto%'     then 'toronto'
  when city ilike '%london%'      then 'london'
  when city ilike '%cairo%'       then 'cairo'
  when city ilike '%khartoum%'    then 'khartoum'
  when city ilike any (array['%dubai%','%abu dhabi%','%riyadh%','%jeddah%','%doha%']) then 'gulf'
  else 'other'
end
where region is null;

-- Posts inherit their author's region.
update posts p set region = pr.region
from profiles pr
where p.author_id = pr.id and p.region is null;

update listings l set region = pr.region
from profiles pr
where l.submitted_by = pr.id and l.region is null;

-- ---------------------------------------------------------------------
-- 4. Enforce
-- ---------------------------------------------------------------------
alter table profiles alter column region set not null;
alter table posts    alter column region set not null;
-- listings.region stays nullable: a listing may be nationwide.

create index if not exists idx_posts_region
  on posts (region, created_at desc) where not is_removed;
create index if not exists idx_listings_region
  on listings (region) where not is_removed;
create index if not exists idx_profiles_region on profiles (region);

-- ---------------------------------------------------------------------
-- 5. Grants
--    Column grants from 0001 do NOT extend to new columns. Without this
--    the app silently cannot write region.
-- ---------------------------------------------------------------------
grant select on regions to anon, authenticated;

grant select (region) on profiles to anon, authenticated;
grant insert (region) on profiles to authenticated;
grant update (region) on profiles to authenticated;

grant insert (region) on posts    to authenticated;
grant update (region) on posts    to authenticated;
grant insert (region) on listings to authenticated;
grant update (region) on listings to authenticated;

-- ---------------------------------------------------------------------
-- 6. public_profiles gains region
-- ---------------------------------------------------------------------
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
         (p.id = auth.uid()) as is_self
  from profiles p
  where not p.is_banned or p.id = auth.uid();

grant select on public_profiles to anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. search_all now filters on region
-- ---------------------------------------------------------------------
drop function if exists search_all(text, text);

create or replace function search_all(q text, filter_region text default null)
returns table (
  result_kind text,
  id          uuid,
  title       text,
  subtitle    text,
  region      text,
  metric      integer,
  created_at  timestamptz,
  rank        real
)
language sql stable as $$
  with tsq as (select websearch_to_tsquery('simple', q) as query)
  select 'listing'::text                                as result_kind,
         l.id                                           as id,
         l.name                                         as title,
         l.service_tag                                  as subtitle,
         l.region                                       as region,
         l.vouch_count                                  as metric,
         l.created_at                                   as created_at,
         (ts_rank(l.search_tsv, tsq.query) + 1.0)::real as rank
         -- +1 keeps listings ranked above posts
  from listings l, tsq
  where not l.is_removed
    and char_length(trim(coalesce(q,''))) > 0
    and (l.search_tsv @@ tsq.query or l.name ilike '%' || q || '%')
    -- a listing with no region is nationwide and always matches
    and (filter_region is null or l.region is null or l.region = filter_region)

  union all

  select 'post'::text,
         p.id,
         p.title,
         p.type::text,
         p.region,
         p.answer_count,
         p.created_at,
         ts_rank(p.search_tsv, tsq.query)::real
  from posts p, tsq
  where not p.is_removed
    and char_length(trim(coalesce(q,''))) > 0
    and p.search_tsv @@ tsq.query
    and (filter_region is null or p.region = filter_region)

  order by 8 desc, 7 desc
  limit 50;
$$;

grant execute on function search_all(text, text) to anon, authenticated;

commit;

-- Verify:
--   select display_name, city, region from profiles;
--   select title, region from posts;
