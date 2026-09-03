-- =====================================================================
-- WASIF LAY — 0052: polls
--
-- Two polls that need an account to vote in: Tournament MVP and Goal of
-- the Day. The account requirement is the point — a poll anyone can
-- answer is worthless as a reason to sign up, and worthless as a poll.
--
-- Options are added by staff as the weekend goes. Nothing is seeded
-- beyond the two polls themselves, because the candidates are players
-- and matches that do not exist yet.
--
-- One vote per person per poll, changeable until the poll closes. A
-- vote you cannot change makes people hesitate before casting one.
-- =====================================================================

begin;

create table if not exists polls (
  id         uuid primary key default gen_random_uuid(),
  question   text        not null check (char_length(trim(question)) between 3 and 200),
  is_open    boolean     not null default true,
  sort_order integer     not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists poll_options (
  id         uuid primary key default gen_random_uuid(),
  poll_id    uuid        not null references polls(id) on delete cascade,
  label      text        not null check (char_length(trim(label)) between 1 and 80),
  sort_order integer     not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_poll_options_poll on poll_options (poll_id, sort_order);

create table if not exists poll_votes (
  poll_id    uuid        not null references polls(id) on delete cascade,
  user_id    uuid        not null references profiles(id) on delete cascade,
  option_id  uuid        not null references poll_options(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

create index if not exists idx_poll_votes_option on poll_votes (option_id);

alter table polls        enable row level security;
alter table poll_options enable row level security;
alter table poll_votes   enable row level security;

-- Everyone can see the polls and their options. Votes are never read
-- directly: the counts come back through the function below, so nobody
-- can see who voted for what.
drop policy if exists polls_read on polls;
create policy polls_read on polls for select using (true);

drop policy if exists poll_options_read on poll_options;
create policy poll_options_read on poll_options for select using (true);

grant select on polls, poll_options to anon, authenticated;

/**
 * Everything the poll list needs, in one call.
 *
 * Returned flat — one row per option, carrying its poll's details — so
 * the component groups them rather than the page making a query per
 * poll. Counts are computed here rather than exposed as a votes table,
 * which is what keeps individual votes private.
 */
create or replace function open_polls()
returns table (
  poll_id     uuid,
  question    text,
  sort_order  integer,
  option_id   uuid,
  label       text,
  opt_order   integer,
  votes       integer,
  total_votes integer,
  is_mine     boolean,
  has_voted   boolean
)
language sql stable security definer set search_path = public
as $$
  select
    p.id,
    p.question,
    p.sort_order,
    o.id,
    o.label,
    o.sort_order,
    (select count(*)::integer from poll_votes v where v.option_id = o.id),
    (select count(*)::integer from poll_votes v where v.poll_id = p.id),
    exists (
      select 1 from poll_votes v
      where v.option_id = o.id and v.user_id = auth.uid()
    ),
    exists (
      select 1 from poll_votes v
      where v.poll_id = p.id and v.user_id = auth.uid()
    )
  from polls p
  join poll_options o on o.poll_id = p.id
  where p.is_open
  order by p.sort_order, p.created_at, o.sort_order, o.created_at;
$$;

grant execute on function open_polls() to anon, authenticated;

/**
 * Casts or changes a vote.
 *
 * Checks that the option genuinely belongs to the poll rather than
 * trusting the pair it was handed — the two ids arrive from the
 * browser, and nothing else here would stop a vote being recorded
 * against a poll it has nothing to do with.
 */
create or replace function cast_vote(p_poll uuid, p_option uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_SIGNED_IN' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from profiles
    where id = auth.uid() and not is_banned and deleted_at is null
  ) then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;

  if not exists (select 1 from polls where id = p_poll and is_open) then
    raise exception 'POLL_CLOSED' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from poll_options where id = p_option and poll_id = p_poll
  ) then
    raise exception 'BAD_OPTION' using errcode = 'P0001';
  end if;

  insert into poll_votes (poll_id, user_id, option_id)
  values (p_poll, auth.uid(), p_option)
  on conflict (poll_id, user_id)
  do update set option_id = excluded.option_id, created_at = now();
end $$;

grant execute on function cast_vote(uuid, uuid) to authenticated;

-- The two polls. No options yet: the candidates are players and goals
-- that have not happened.
insert into polls (question, sort_order, is_open)
select 'Tournament MVP', 10, true
where not exists (select 1 from polls where question = 'Tournament MVP');

insert into polls (question, sort_order, is_open)
select 'Goal of the Day', 20, true
where not exists (select 1 from polls where question = 'Goal of the Day');

commit;

-- Add candidates as the weekend goes:
--
--   insert into poll_options (poll_id, label, sort_order)
--   select id, 'Player name', 10 from polls where question = 'Tournament MVP';
--
-- Close one when it is decided:
--
--   update polls set is_open = false where question = 'Goal of the Day';
--
-- A poll with no options does not appear, so both stay invisible until
-- you add candidates.
