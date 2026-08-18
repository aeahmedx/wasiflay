-- =====================================================================
-- WASIF LAY — 0005: region-less posts
--
-- Some posts aren't local: a national tournament announcement, a
-- question about paperwork that works the same everywhere, an
-- opportunity open to anyone. region = NULL means "all regions" and the
-- post surfaces in every regional feed as well as the unfiltered one.
--
-- This mirrors how listings already behave (0003): a null region is
-- nationwide, not missing data.
-- =====================================================================

begin;

alter table posts alter column region drop not null;

comment on column posts.region is
  'NULL means the post belongs to every region, not that it is unset.';

-- Regional feeds need to find null-region posts too, so the partial
-- index on (region, created_at) is no longer sufficient on its own.
create index if not exists idx_posts_all_regions
  on posts (created_at desc) where region is null and not is_removed;

-- ---------------------------------------------------------------------
-- search_all: a null-region post matches every region filter
-- ---------------------------------------------------------------------
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
  from listings l, tsq
  where not l.is_removed
    and char_length(trim(coalesce(q,''))) > 0
    and (l.search_tsv @@ tsq.query or l.name ilike '%' || q || '%')
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
    and (filter_region is null or p.region is null or p.region = filter_region)

  order by 8 desc, 7 desc
  limit 50;
$$;

grant execute on function search_all(text, text) to anon, authenticated;

commit;
