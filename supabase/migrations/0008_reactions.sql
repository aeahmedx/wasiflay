-- =====================================================================
-- WASIF LAY — 0008: message reactions
--
-- Most people never type. One tap is the difference between a room of
-- 40 talkers and a room of 400 participants, and it gives quieter users
-- — teenagers especially — a way to be present without exposure.
--
-- The emoji set is fixed at the database level. Free-form reactions are
-- a moderation surface nobody needs.
-- =====================================================================

begin;

create table if not exists message_reactions (
  id         uuid primary key default gen_random_uuid(),
  message_id uuid        not null references messages(id) on delete cascade,
  room_id    uuid        not null references rooms(id) on delete cascade,
  user_id    uuid        not null references profiles(id) on delete cascade,
  emoji      text        not null check (emoji in ('🔥','😂','⚽','👏','❤️','😮')),
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

create index if not exists idx_reactions_room
  on message_reactions (room_id, created_at desc);
create index if not exists idx_reactions_message
  on message_reactions (message_id);

-- ---------------------------------------------------------------------
-- room_id is denormalised so realtime can filter on it — the table has
-- no other link to a room. It is set by trigger rather than by the
-- client, so it cannot be spoofed to leak reactions across rooms.
-- ---------------------------------------------------------------------
create or replace function set_reaction_room()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select m.room_id into new.room_id from messages m where m.id = new.message_id;
  if new.room_id is null then
    raise exception 'MESSAGE_NOT_FOUND' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists t_reactions_room on message_reactions;
create trigger t_reactions_room before insert on message_reactions
  for each row execute function set_reaction_room();

-- Rate limit: a tap is cheap, but not free.
create or replace function rate_limit_reactions()
returns trigger language plpgsql security definer set search_path = public as $$
declare recent integer;
begin
  select count(*) into recent from message_reactions
  where user_id = new.user_id and created_at > now() - interval '10 seconds';
  if recent >= 20 then
    raise exception 'RATE_LIMIT: slow down' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists t_reactions_ratelimit on message_reactions;
create trigger t_reactions_ratelimit before insert on message_reactions
  for each row execute function rate_limit_reactions();

-- ---------------------------------------------------------------------
-- RLS + grants
-- New tables get no anon/authenticated privileges by default in this
-- project, so both are required.
-- ---------------------------------------------------------------------
alter table message_reactions enable row level security;

drop policy if exists reactions_read on message_reactions;
create policy reactions_read on message_reactions
  for select using (true);

drop policy if exists reactions_insert on message_reactions;
create policy reactions_insert on message_reactions
  for insert with check (auth.uid() = user_id and is_active_user());

drop policy if exists reactions_delete_own on message_reactions;
create policy reactions_delete_own on message_reactions
  for delete using (auth.uid() = user_id);

grant select on message_reactions to anon, authenticated;
-- room_id is deliberately absent: the trigger owns it.
grant insert (message_id, user_id, emoji) on message_reactions to authenticated;
grant delete on message_reactions to authenticated;

-- ---------------------------------------------------------------------
-- Realtime. FULL replica identity so DELETE events carry the emoji and
-- message_id — without it, removing a reaction can't be applied to the
-- other clients' state.
-- ---------------------------------------------------------------------
alter table message_reactions replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table message_reactions;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

commit;
