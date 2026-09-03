-- =====================================================================
-- WASIF LAY — 0055: the weekend beyond the pitch
--
-- Everything happening around SASF 2026 that isn't a football match:
-- the Friday warm-up, both Nile Nights, the fashion show, the cultural
-- tent, the all-star game, the bazaar and its vendors, the volleyball,
-- the youth brackets, and how to actually get in.
--
-- Posted as approved events by a staff account, because these are
-- announcements of somebody else's programme rather than submissions
-- waiting on review.
--
-- ---------------------------------------------------------------------
-- The rate limiter
--
-- t_events_ratelimit refuses a sixth event from the same creator inside
-- an hour, which is right for a person and wrong for a bulk import. It
-- is disabled by name for the duration and re-enabled immediately after
-- — not session_replication_role, which would silently switch off every
-- trigger on every table including the ones that maintain counts and
-- flag minors.
--
-- If this script fails midway the transaction rolls back and the
-- trigger comes back with it, because ALTER TABLE is transactional in
-- Postgres. There is no state where the limiter is left off.
-- ---------------------------------------------------------------------
--
-- Times carry an explicit -04 offset, which is EDT, what New York is on
-- those dates. Without it Postgres reads them as UTC and every event
-- lands four hours early.
--
-- Idempotent: re-running skips any title already present.
-- =====================================================================

begin;

alter table events disable trigger t_events_ratelimit;

do $seed$
declare
  -- ------------------------------------------------------------------
  -- SET THIS to a staff profile id. Find it with:
  --   select id, display_name, role from profiles
  --    where role in ('moderator', 'admin');
  -- ------------------------------------------------------------------
  v_creator uuid := '00000000-0000-0000-0000-000000000000';

  v_n   integer := 0;
  v_row record;
begin
  if not exists (
    select 1 from profiles
    where id = v_creator and role in ('moderator', 'admin')
  ) then
    raise exception
      'Set v_creator to a staff profile id before running this script.';
  end if;

  for v_row in
    select * from (values
      (
        E'Hoops & Hangout — the Friday warm-up',
        E'A pre-festival icebreaker the day before everything starts. Casual basketball runs, music, snacks and drinks.\n\nBring your squad. Everyone welcome.\n\nAnnounced on Instagram rather than by the federation, so check there for any change of time.',
        timestamptz '2026-09-04 15:00:00-04',
        null::timestamptz,
        E'Maybrook, NY',
        E'Maybrook, NY'
      ),
      (
        E'The Kickback — Nile Nights × SASF',
        E'Music, vendors and food the night before the tournament.\n\nSounds by DJ Love Bonez. Hosted by Akram and Bebo. Live performance by Omer Suliman. Food trucks and cultural vendors inside the venue.\n\n18+. Tickets on Eventbrite.',
        timestamptz '2026-09-05 21:30:00-04',
        timestamptz '2026-09-06 01:30:00-04',
        E'The Kickback',
        E'60 Dubois St, Newburgh, NY 12550'
      ),
      (
        E'Nile Nights × Alsarah & The Nubatones',
        E'The Sunday night concert. Alsarah & The Nubatones performing live — East African retro-pop and Nubian sound.\n\nThe second half of Nile Nights'' SASF weekend: the Kickback on Saturday, this on Sunday.\n\nCheck @nile.nights for the venue and tickets.',
        timestamptz '2026-09-06 21:00:00-04',
        null::timestamptz,
        E'New York',
        E'New York, NY'
      ),
      (
        E'Fashion Show — عرض الأزياء',
        E'The first show of its kind in New York, hosted by the Haneen Foundation.\n\nArtist Samira. Designers Amal Ramadan and Alaa Bakr, among others.\n\nWomen only — للنساء فقط.\n\nTickets $40. Booking on WhatsApp 347-254-1203.\n\nNote: a second version of the flyer showed a different number. The one above is from the flyer with full designer credits.',
        timestamptz '2026-09-05 21:00:00-04',
        timestamptz '2026-09-06 00:00:00-04',
        E'Middletown, NY',
        E'Middletown, NY'
      ),
      (
        E'Jalsat Tarab — جلسة طرب',
        E'The cultural tent''s daytime programme. Sudanese heritage music, family atmosphere.\n\nFeaturing Nouri and Hassan Columbus.\n\nRuns both days, 11am to 7pm. A family event.',
        timestamptz '2026-09-05 11:00:00-04',
        timestamptz '2026-09-05 19:00:00-04',
        E'Blue Sky Sports Complex',
        E'162 O''Haire Rd, Middletown, NY 10941'
      ),
      (
        E'Mohamed Al-Wasila — محمد الوسيلة',
        E'Announced by SASF as the official daytime star of the weekend.\n\nPart of the daytime programme at the complex.',
        timestamptz '2026-09-06 11:00:00-04',
        timestamptz '2026-09-06 19:00:00-04',
        E'Blue Sky Sports Complex',
        E'162 O''Haire Rd, Middletown, NY 10941'
      ),
      (
        E'Shabbal — شبال',
        E'Sudanese and East African performing arts. Drumming, heritage and movement.\n\n"The rhythm of Sudan is coming to New York." Live across both days.',
        timestamptz '2026-09-05 12:00:00-04',
        timestamptz '2026-09-06 19:00:00-04',
        E'Blue Sky Sports Complex',
        E'162 O''Haire Rd, Middletown, NY 10941'
      ),
      (
        E'All-Star Game — Team Shareef v Team Bebo',
        E'Sawt Al Balad × SASF × NYSAFCY.\n\nTeam Shareef: Radi, Sudanipapi, Naf, Imafuture, Obeezy.\nTeam Bebo: Mojo, Akram, Samiosman, Aymen Jr, Aymen Jiggy.\n\nFans and spectators welcome.',
        timestamptz '2026-09-06 17:15:00-04',
        timestamptz '2026-09-06 19:00:00-04',
        E'Blue Sky Sports Complex',
        E'162 O''Haire Rd, Middletown, NY 10941'
      ),
      (
        E'The Bazaar — البازار',
        E'Food, drinks, perfumes, clothing, accessories and gifts from Sudanese vendors, both days.\n\nVendor registration is temporarily closed — more interest than space. Anyone already registered should check their email to confirm their table and pay the fee. It may reopen if someone withdraws.\n\nVendor questions: bazar.info@nysafcy.org',
        timestamptz '2026-09-05 11:00:00-04',
        timestamptz '2026-09-06 19:00:00-04',
        E'Blue Sky Sports Complex',
        E'162 O''Haire Rd, Middletown, NY 10941'
      ),
      (
        E'Alwarda pop-up shop',
        E'The Sudanese boutique Alwarda is running a pop-up at the bazaar — traditional clothing, custom fragrances and community pieces.\n\nThey announced a weekend discount code for attendees: SASFNY.',
        timestamptz '2026-09-05 11:00:00-04',
        timestamptz '2026-09-06 19:00:00-04',
        E'Blue Sky Sports Complex',
        E'162 O''Haire Rd, Middletown, NY 10941'
      ),
      (
        E'Sadagaat USA booth',
        E'The humanitarian charity Sadagaat is on site as a sponsor with a field booth — updates on their projects in Sudan, and a place to talk to them directly.',
        timestamptz '2026-09-05 09:00:00-04',
        timestamptz '2026-09-06 19:00:00-04',
        E'Blue Sky Sports Complex',
        E'162 O''Haire Rd, Middletown, NY 10941'
      ),
      (
        E'Sawt Al Balad media stand',
        E'The community media platform Sawt Al Balad is the official media hub on site, recording interviews and tournament updates across both days.\n\nThey also co-present the All-Star game.',
        timestamptz '2026-09-05 09:00:00-04',
        timestamptz '2026-09-06 19:00:00-04',
        E'Blue Sky Sports Complex',
        E'162 O''Haire Rd, Middletown, NY 10941'
      ),
      (
        E'Volleyball — women''s and men''s tournaments',
        E'The first women''s volleyball tournament in SASF''s twenty-five years, hosted by NYSAFCY, running alongside the men''s tournament.\n\nBoth days at the complex.',
        timestamptz '2026-09-05 10:00:00-04',
        timestamptz '2026-09-06 18:00:00-04',
        E'Blue Sky Sports Complex',
        E'162 O''Haire Rd, Middletown, NY 10941'
      ),
      (
        E'Youth tournaments — U13 and U17',
        E'U13: Boston, New York City, Ohio, Philadelphia, Richmond, Albany, California.\n\nU17 groups — A: Michigan, Indiana, Richmond. B: Central PA, Ohio, Albany. C: New York City, Philadelphia, Virginia. D: Connecticut, Boston.\n\nBoth days at the complex.',
        timestamptz '2026-09-05 09:00:00-04',
        timestamptz '2026-09-06 18:00:00-04',
        E'Blue Sky Sports Complex',
        E'162 O''Haire Rd, Middletown, NY 10941'
      ),
      (
        E'Tickets and entry — no cash at the gate',
        E'$7 in advance for both days. $10 at the door. Under 15s free.\n\nNo cash is accepted at the gate — tickets must be bought online in advance. Buy at zeffy.com, linked from sasfone.org.\n\nGates run roughly 8am to 8pm both days. Show your ticket at the entrance and it covers both days.',
        timestamptz '2026-09-05 08:00:00-04',
        timestamptz '2026-09-06 20:00:00-04',
        E'Blue Sky Sports Complex',
        E'162 O''Haire Rd, Middletown, NY 10941'
      )
    ) as t(title, description, starts_at, ends_at, venue_name, address)
  loop
    if not exists (select 1 from events where title = v_row.title) then
      insert into events (
        creator_id, title, description, kind,
        starts_at, ends_at, region,
        venue_name, address,
        organizer_name, organizer_email,
        status, reviewed_by, reviewed_at
      ) values (
        v_creator,
        v_row.title,
        v_row.description,
        'physical',
        v_row.starts_at,
        v_row.ends_at,
        null,
        v_row.venue_name,
        v_row.address,
        'SASF',
        'info@sasfone.org',
        'approved',
        v_creator,
        now()
      );

      v_n := v_n + 1;
    end if;
  end loop;

  raise notice 'Added % events', v_n;
end $seed$;

alter table events enable trigger t_events_ratelimit;

commit;

-- Confirm the limiter is back on:
--   select tgname, tgenabled from pg_trigger
--    where tgrelid = 'events'::regclass and not tgisinternal;
--
-- tgenabled should read 'O'. Anything else means it is still disabled.
--
-- Check what landed:
--   select to_char(starts_at at time zone 'America/New_York',
--                  'Dy HH24:MI') as local, title
--     from events
--    where starts_at >= '2026-09-04'
--    order by starts_at;
--
-- To undo:
--   delete from events
--    where organizer_name = 'SASF' and creator_id = '<the id you used>';
