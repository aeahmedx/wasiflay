-- =====================================================================
-- WASIF LAY — 0016: users control their own content
--
-- Editing a post or answer already worked. Missing: editing messages,
-- and deleting anything at all. Someone who posts a phone number and
-- regrets it currently has no way out except editing it to blank or
-- reporting themselves.
--
-- Own-deletion is SOFT. If a post with six answers is deleted, those
-- answers were other people's work, and the trail matters if the
-- deletion was to cover something. From the user's side it's gone either
-- way. Only admins delete for real (0015).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Editing messages
-- ---------------------------------------------------------------------
alter table messages add column if not exists edited_at timestamptz;

grant select (edited_at) on messages to anon, authenticated;
-- body only: edited_at is set by trigger so it can't be faked.
grant update (body) on messages to authenticated;

drop policy if exists messages_update_own on messages;
create policy messages_update_own on messages
  for update using (auth.uid() = author_id and not is_removed)
  with check (auth.uid() = author_id);

create or replace function stamp_message_edit()
returns trigger language plpgsql as $$
begin
  if new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end $$;

drop trigger if exists t_messages_edited on messages;
create trigger t_messages_edited before update on messages
  for each row execute function stamp_message_edit();

-- ---------------------------------------------------------------------
-- 2. Deleting your own content
--
-- Done through an RPC rather than by granting update(is_removed):
-- the intent is explicit, and a future policy change can't accidentally
-- widen what a user can flag as removed.
-- ---------------------------------------------------------------------
create or replace function delete_own_content(
  p_target report_target,
  p_id     uuid
)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare owner uuid;
begin
  if auth.uid() is null then
    raise exception 'NOT_SIGNED_IN' using errcode = 'P0001';
  end if;

  if p_target = 'post' then
    select author_id into owner from posts where id = p_id and not is_removed;
  elsif p_target = 'answer' then
    select author_id into owner from answers where id = p_id and not is_removed;
  elsif p_target = 'message' then
    select author_id into owner from messages where id = p_id and not is_removed;
  else
    raise exception 'UNSUPPORTED_TARGET' using errcode = 'P0001';
  end if;

  if owner is null then
    return false;              -- already gone, or never existed
  end if;

  if owner <> auth.uid() then
    raise exception 'NOT_YOURS' using errcode = 'P0001';
  end if;

  if p_target = 'post' then
    update posts    set is_removed = true where id = p_id;
  elsif p_target = 'answer' then
    update answers  set is_removed = true where id = p_id;
  else
    update messages set is_removed = true where id = p_id;
  end if;

  return true;
end $$;

grant execute on function delete_own_content(report_target, uuid)
  to authenticated;

-- ---------------------------------------------------------------------
-- 3. Storage: let people remove their own uploads
--
-- 0015 gave staff delete rights. An author deleting their own photo
-- needs the file gone too, or it stays reachable by URL.
-- ---------------------------------------------------------------------
drop policy if exists "staff can delete uploads" on storage.objects;
create policy "delete own uploads or staff"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'uploads'
    and (owner = auth.uid() or is_staff())
  );

commit;
