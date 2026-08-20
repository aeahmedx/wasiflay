-- =====================================================================
-- WASIF LAY — 0023: content safety
--
-- The rule this is built on: sharing a phone number IS the product.
-- "Who knows a mechanic?" → "Call Ahmed, 215-555-0134" is the exact
-- exchange the platform exists for. So contact details are warned about
-- and flagged for review, never blocked.
--
-- Only two things are hard-blocked, because neither has a legitimate
-- use here and both cause immediate harm:
--   * card numbers (Luhn-validated, so real ones — not any 16 digits)
--   * the same text posted over and over
--
-- Everything else goes to the moderation queue as an automatic report.
-- =====================================================================

begin;

-- Automatic reports have no human reporter.
alter table reports alter column reporter_id drop not null;

-- ---------------------------------------------------------------------
-- Digit normalisation
--
-- Arabic-Indic digits are ordinary digits to the people using them, and
-- a filter that only understands 0-9 is bypassed by typing ٠١٢ instead.
-- Both the Arabic and the Extended Arabic (Persian/Urdu) sets are
-- folded here.
-- ---------------------------------------------------------------------
create or replace function normalize_digits(p text)
returns text
language sql immutable
as $$
  select translate(
    coalesce(p, ''),
    '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
    '01234567890123456789'
  );
$$;

-- ---------------------------------------------------------------------
-- Luhn check
--
-- Without this, every order number, tracking code and 16-digit ID gets
-- blocked as a card. With it, only sequences that are actually valid
-- card numbers match.
-- ---------------------------------------------------------------------
create or replace function luhn_ok(p_digits text)
returns boolean
language plpgsql immutable
as $$
declare
  total int := 0;
  d     int;
  i     int;
  dbl   boolean := false;
begin
  if p_digits !~ '^\d{13,19}$' then
    return false;
  end if;

  for i in reverse length(p_digits)..1 loop
    d := substr(p_digits, i, 1)::int;
    if dbl then
      d := d * 2;
      if d > 9 then d := d - 9; end if;
    end if;
    total := total + d;
    dbl := not dbl;
  end loop;

  return total % 10 = 0;
end $$;

create or replace function contains_card_number(p_text text)
returns boolean
language plpgsql immutable
as $$
declare
  norm   text := normalize_digits(p_text);
  m      text[];
  digits text;
begin
  if norm = '' then return false; end if;

  -- Digit runs that may be split by spaces or dashes, as people write
  -- card numbers.
  for m in
    select regexp_matches(norm, '(?:\d[ -]?){13,19}', 'g')
  loop
    digits := regexp_replace(m[1], '\D', '', 'g');
    if luhn_ok(digits) then
      return true;
    end if;
  end loop;

  return false;
end $$;

-- ---------------------------------------------------------------------
-- What's worth a moderator's attention
--
-- Returns labels, not a verdict. Nothing here stops a post.
-- ---------------------------------------------------------------------
create or replace function content_flags(p_text text)
returns text[]
language plpgsql immutable
as $$
declare
  norm  text := normalize_digits(p_text);
  flags text[] := '{}';
begin
  if norm = '' then return flags; end if;

  -- Seven or more digits with phone-ish separators. The length floor
  -- keeps years, prices and street numbers out.
  if norm ~ '(\+?\d[\d\s().-]{5,}\d)'
     and length(regexp_replace(
       (regexp_match(norm, '(\+?\d[\d\s().-]{5,}\d)'))[1], '\D', '', 'g'
     )) >= 7
  then
    flags := array_append(flags, 'phone');
  end if;

  if norm ~* '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}' then
    flags := array_append(flags, 'email');
  end if;

  -- Group invite links get their own label: they move people off a
  -- moderated space into an unmoderated one, which is the pattern worth
  -- looking at rather than links in general.
  if norm ~* '(chat\.whatsapp\.com|t\.me/|discord\.gg|join\.slack\.com)' then
    flags := array_append(flags, 'invite');
  elsif norm ~* '(https?://|www\.)' then
    flags := array_append(flags, 'link');
  end if;

  return flags;
end $$;

create or replace function flag_label(p_flag text)
returns text
language sql immutable
as $$
  select case p_flag
    when 'phone'  then 'Automatic: contains a phone number'
    when 'email'  then 'Automatic: contains an email address'
    when 'link'   then 'Automatic: contains a link'
    when 'invite' then 'Automatic: contains a group invite link'
    else 'Automatic: flagged for review'
  end;
$$;

-- ---------------------------------------------------------------------
-- Hard blocks, applied before the row is written
-- ---------------------------------------------------------------------
create or replace function guard_content()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  body_text text;
  norm      text;
  repeats   int;
begin
  body_text := case tg_table_name
                 when 'posts' then coalesce(new.title,'') || ' ' || coalesce(new.body,'')
                 else coalesce(new.body,'')
               end;

  if contains_card_number(body_text) then
    raise exception 'CARD_NUMBER' using errcode = 'P0001';
  end if;

  -- The same thing over and over. Normalised so spacing and case don't
  -- dodge it. Short messages are exempt — "yes" and "😂" repeat
  -- legitimately in a live room.
  norm := lower(regexp_replace(trim(body_text), '\s+', ' ', 'g'));

  if length(norm) >= 15 then
    if tg_table_name = 'posts' then
      select count(*) into repeats from posts
       where author_id = new.author_id
         and created_at > now() - interval '1 hour'
         and lower(regexp_replace(trim(coalesce(title,'') || ' ' || coalesce(body,'')), '\s+', ' ', 'g')) = norm;
    elsif tg_table_name = 'answers' then
      select count(*) into repeats from answers
       where author_id = new.author_id
         and created_at > now() - interval '1 hour'
         and lower(regexp_replace(trim(coalesce(body,'')), '\s+', ' ', 'g')) = norm;
    else
      select count(*) into repeats from messages
       where author_id = new.author_id
         and created_at > now() - interval '1 hour'
         and lower(regexp_replace(trim(coalesce(body,'')), '\s+', ' ', 'g')) = norm;
    end if;

    if repeats >= 2 then
      raise exception 'DUPLICATE' using errcode = 'P0001';
    end if;
  end if;

  -- Photo flood protection. Generous enough that nobody at an event
  -- notices, low enough that a script doesn't drain the storage bill.
  if tg_table_name = 'messages' and new.image_url is not null then
    select count(*) into repeats from messages
     where author_id = new.author_id
       and image_url is not null
       and created_at > now() - interval '24 hours';
    if repeats >= 100 then
      raise exception 'UPLOAD_LIMIT' using errcode = 'P0001';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists t_posts_guard on posts;
create trigger t_posts_guard before insert on posts
  for each row execute function guard_content();

drop trigger if exists t_answers_guard on answers;
create trigger t_answers_guard before insert on answers
  for each row execute function guard_content();

drop trigger if exists t_messages_guard on messages;
create trigger t_messages_guard before insert on messages
  for each row execute function guard_content();

-- ---------------------------------------------------------------------
-- Automatic flagging, after the row exists
--
-- One report per item, however many things it trips — a post with a
-- phone number and a link is one thing to look at, not two.
-- ---------------------------------------------------------------------
create or replace function autoflag_content()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  body_text text;
  flags     text[];
  target    report_target;
  reason    text;
begin
  body_text := case tg_table_name
                 when 'posts' then coalesce(new.title,'') || ' ' || coalesce(new.body,'')
                 else coalesce(new.body,'')
               end;

  flags := content_flags(body_text);
  if array_length(flags, 1) is null then
    return null;
  end if;

  target := case tg_table_name
              when 'posts'   then 'post'::report_target
              when 'answers' then 'answer'::report_target
              else 'message'::report_target
            end;

  select string_agg(flag_label(f), ' · ') into reason
    from unnest(flags) as f;

  insert into reports (reporter_id, target_type, target_id, reason)
  values (null, target, new.id, reason);

  return null;
end $$;

drop trigger if exists t_posts_autoflag on posts;
create trigger t_posts_autoflag after insert on posts
  for each row execute function autoflag_content();

drop trigger if exists t_answers_autoflag on answers;
create trigger t_answers_autoflag after insert on answers
  for each row execute function autoflag_content();

drop trigger if exists t_messages_autoflag on messages;
create trigger t_messages_autoflag after insert on messages
  for each row execute function autoflag_content();

commit;
