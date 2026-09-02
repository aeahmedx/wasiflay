-- =====================================================================
-- WASIF LAY — 0048: promoter attribution
--
-- Printed cards carry wasiflay.com/t/CODE. Tapping it drops a cookie,
-- and whoever eventually creates an account is credited to that code.
--
-- Stored as plain text rather than a foreign key on purpose. A typo on
-- a printed card, or a code someone invents, must never break a
-- sign-up — attribution is a nice-to-have and an account is not. The
-- dashboard left-joins for labels, so an unrecognised code still shows
-- up rather than vanishing.
-- =====================================================================

begin;

create table if not exists promoter_codes (
  code       text primary key,
  label      text not null,
  created_at timestamptz not null default now()
);

alter table promoter_codes enable row level security;

drop policy if exists promoter_codes_read on promoter_codes;
create policy promoter_codes_read on promoter_codes
  for select using (is_staff());

grant select on promoter_codes to authenticated;

-- Deliberately no foreign key: see the note above.
alter table profiles
  add column if not exists promo_code text;

create index if not exists idx_profiles_promo
  on profiles (promo_code, created_at desc)
  where promo_code is not null;

/**
 * Totals per code, newest signup first.
 *
 * Left join so a code nobody has used still appears with zero — a
 * promoter who has brought nobody is exactly who you want to see on
 * the dashboard.
 */
create or replace function promoter_stats()
returns table (
  code          text,
  label         text,
  signups       integer,
  signups_today integer,
  last_signup   timestamptz
)
language sql stable security definer set search_path = public
as $$
  select
    c.code,
    c.label,
    count(p.id)::integer,
    count(p.id) filter (
      where p.created_at >= date_trunc('day', now() at time zone 'America/New_York')
              at time zone 'America/New_York'
    )::integer,
    max(p.created_at)
  from promoter_codes c
  left join profiles p
         on p.promo_code = c.code and p.deleted_at is null
  where is_staff()
  group by c.code, c.label
  order by count(p.id) desc, c.code;
$$;

grant execute on function promoter_stats() to authenticated;

/**
 * Signups per hour for the last N hours, including hours with none —
 * a flat stretch is information, and a chart with gaps in it lies.
 */
create or replace function signups_by_hour(p_hours integer default 24)
returns table (hour timestamptz, signups integer)
language sql stable security definer set search_path = public
as $$
  select h.hour, count(p.id)::integer
  from generate_series(
         date_trunc('hour', now()) - make_interval(hours => greatest(p_hours, 1) - 1),
         date_trunc('hour', now()),
         interval '1 hour'
       ) as h(hour)
  left join profiles p
         on date_trunc('hour', p.created_at) = h.hour
        and p.deleted_at is null
  where is_staff()
  group by h.hour
  order by h.hour;
$$;

grant execute on function signups_by_hour(integer) to authenticated;

/** Headline numbers, so the dashboard is one call for the top row. */
create or replace function signup_totals()
returns table (
  total          integer,
  today          integer,
  last_hour      integer,
  attributed     integer,
  with_a_pick    integer
)
language sql stable security definer set search_path = public
as $$
  select
    count(*)::integer,
    count(*) filter (
      where created_at >= date_trunc('day', now() at time zone 'America/New_York')
              at time zone 'America/New_York'
    )::integer,
    count(*) filter (where created_at >= now() - interval '1 hour')::integer,
    count(*) filter (where promo_code is not null)::integer,
    (select count(distinct user_id)::integer from predictions)
  from profiles
  where deleted_at is null and is_staff();
$$;

grant execute on function signup_totals() to authenticated;

-- ---------------------------------------------------------------------
-- The codes. Twenty-five for people, one for anything unattributed.
--
-- Short and unambiguous on a printed card: no O/0, no I/1, no lowercase.
-- Relabel them in the table as you hand them out.
-- ---------------------------------------------------------------------
insert into promoter_codes (code, label) values
  ('NY01', 'Card 01'), ('NY02', 'Card 02'), ('NY03', 'Card 03'),
  ('NY04', 'Card 04'), ('NY05', 'Card 05'), ('NY06', 'Card 06'),
  ('NY07', 'Card 07'), ('NY08', 'Card 08'), ('NY09', 'Card 09'),
  ('NY10', 'Card 10'), ('NY11', 'Card 11'), ('NY12', 'Card 12'),
  ('NY13', 'Card 13'), ('NY14', 'Card 14'), ('NY15', 'Card 15'),
  ('NY16', 'Card 16'), ('NY17', 'Card 17'), ('NY18', 'Card 18'),
  ('NY19', 'Card 19'), ('NY20', 'Card 20'), ('NY21', 'Card 21'),
  ('NY22', 'Card 22'), ('NY23', 'Card 23'), ('NY24', 'Card 24'),
  ('NY25', 'Card 25'),
  ('HOUSE', 'House card')
on conflict (code) do nothing;

commit;

-- Rename a card once you know who has it:
--   update promoter_codes set label = 'Yasir' where code = 'NY07';
