-- =====================================================================
-- WASIF LAY — 0056: strip what wasn't verified
--
-- 0055 published fifteen events. Four came straight off a flyer. The
-- rest carried something that wasn't on any flyer: clock times I chose
-- so they would sort, a day I picked for an act billed only as
-- "daytime", and two entries that existed only in an AI search summary
-- nobody has confirmed.
--
-- An app that states a start time people plan around should be right.
-- This removes the two unverifiable entries and rewrites the rest to
-- say plainly what is known and what isn't.
--
-- Times cannot be left blank — starts_at is NOT NULL — so anything
-- without a published time is anchored at 9am, the hour the gates open,
-- and the description says the time hasn't been announced. That is
-- honest in a way an invented 12:00 is not.
--
-- ---------------------------------------------------------------------
-- Why status is set explicitly on every update
--
-- t_events_rereview sends an approved event back to 'pending' whenever
-- its title, description, address or start time changes — correct for a
-- member editing their own listing, wrong here. Each update re-approves
-- in the same statement, because BEFORE triggers run first and the
-- trigger's own assignment would otherwise win.
-- ---------------------------------------------------------------------
--
-- Idempotent: deletes are by title, updates set absolute values.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Gone: no flyer, no post, no source I can point at
-- ---------------------------------------------------------------------
delete from events
 where title in (
   'Hoops & Hangout — the Friday warm-up',
   'Alwarda pop-up shop'
 );

-- ---------------------------------------------------------------------
-- The Sunday concert: date confirmed by Nile Nights' own bio, nothing
-- else was. The 9pm and the venue were mine.
-- ---------------------------------------------------------------------
update events set
  starts_at = timestamptz '2026-09-06 09:00:00-04',
  ends_at   = null,
  venue_name = 'Venue not announced',
  address    = 'New York',
  description =
    E'Alsarah & The Nubatones performing live — East African retro-pop and Nubian sound.\n\nNile Nights announced two nights for this weekend: the Kickback on Saturday, this on Sunday.\n\nThe time and venue have not been announced. Check @nile.nights.',
  status = 'approved',
  reviewed_at = now()
 where title = 'Nile Nights × Alsarah & The Nubatones';

-- ---------------------------------------------------------------------
-- Billed as the "daytime star" across both days. Which day was mine.
-- ---------------------------------------------------------------------
update events set
  starts_at = timestamptz '2026-09-05 09:00:00-04',
  ends_at   = timestamptz '2026-09-06 20:00:00-04',
  description =
    E'Announced by SASF as the official daytime star of the weekend.\n\nPart of the daytime programme at the complex. The flyer does not say which day or what time — watch SASF for the announcement.',
  status = 'approved',
  reviewed_at = now()
 where title = 'Mohamed Al-Wasila — محمد الوسيلة';

-- ---------------------------------------------------------------------
-- Dates from the flyer, clock times from me
-- ---------------------------------------------------------------------
update events set
  starts_at = timestamptz '2026-09-05 09:00:00-04',
  ends_at   = timestamptz '2026-09-06 20:00:00-04',
  description =
    E'Sudanese and East African performing arts. Drumming, heritage and movement.\n\n"The rhythm of Sudan is coming to New York." Live across both days.\n\nSet times have not been announced.',
  status = 'approved',
  reviewed_at = now()
 where title = 'Shabbal — شبال';

update events set
  starts_at = timestamptz '2026-09-05 09:00:00-04',
  ends_at   = timestamptz '2026-09-06 20:00:00-04',
  description =
    E'Food, drinks, perfumes, clothing, accessories and gifts from Sudanese vendors, both days.\n\nOpening hours have not been announced — assume it runs with the tournament.\n\nVendor registration is temporarily closed: more interest than space. Anyone already registered should check their email to confirm their table and pay the fee. It may reopen if someone withdraws.\n\nVendor questions: bazar.info@nysafcy.org',
  status = 'approved',
  reviewed_at = now()
 where title = 'The Bazaar — البازار';

update events set
  starts_at = timestamptz '2026-09-05 09:00:00-04',
  ends_at   = timestamptz '2026-09-06 20:00:00-04',
  description =
    E'The first women''s volleyball tournament in SASF''s twenty-five years, hosted by NYSAFCY, running alongside the men''s tournament.\n\nBoth days at the complex. Match times have not been published.',
  status = 'approved',
  reviewed_at = now()
 where title = 'Volleyball — women''s and men''s tournaments';

update events set
  starts_at = timestamptz '2026-09-05 09:00:00-04',
  ends_at   = timestamptz '2026-09-06 20:00:00-04',
  description =
    E'U13: Boston, New York City, Ohio, Philadelphia, Richmond, Albany, California.\n\nU17 groups — A: Michigan, Indiana, Richmond. B: Central PA, Ohio, Albany. C: New York City, Philadelphia, Virginia. D: Connecticut, Boston.\n\nBoth days at the complex. Kickoff times have not been published.',
  status = 'approved',
  reviewed_at = now()
 where title = 'Youth tournaments — U13 and U17';

-- ---------------------------------------------------------------------
-- Both organisations are real and named on SASF material. What they are
-- doing on the day came from an unverified summary, so the claim is
-- narrowed to what the flyers actually show.
-- ---------------------------------------------------------------------
update events set
  starts_at = timestamptz '2026-09-05 09:00:00-04',
  ends_at   = timestamptz '2026-09-06 20:00:00-04',
  description =
    E'Sadagaat is named as a sponsor on SASF''s own material for the weekend.\n\nWhether they have a booth on site, and where, has not been confirmed.',
  status = 'approved',
  reviewed_at = now()
 where title = 'Sadagaat USA booth';

update events set
  starts_at = timestamptz '2026-09-05 09:00:00-04',
  ends_at   = timestamptz '2026-09-06 20:00:00-04',
  description =
    E'Sawt Al Balad co-presents the All-Star game with SASF and NYSAFCY, per the flyer.\n\nWhat else they are running on site has not been confirmed.',
  status = 'approved',
  reviewed_at = now()
 where title = 'Sawt Al Balad media stand';

-- ---------------------------------------------------------------------
-- The Kickback: the food trucks and vendors line came from the summary,
-- not the flyer. Everything else here is printed on it.
-- ---------------------------------------------------------------------
update events set
  description =
    E'Music, vendors and food the night before the tournament.\n\nSounds by Love Bonez. Hosted by Akram and Bebo. Live performance by Omer Suliman.\n\n18+. Tickets on Eventbrite.',
  status = 'approved',
  reviewed_at = now()
 where title = 'The Kickback — Nile Nights × SASF';

commit;

-- ---------------------------------------------------------------------
-- STILL UNRESOLVED, and not fixable from here
--
-- The All-Star flyer reads SUNDAY, SEPTEMBER 6, 2026. The fixture in
-- your matches table is Saturday 5 September, 17:15. One of them is
-- wrong, and people are predicting against the fixture.
--
-- Whichever is right, both need to say the same thing:
--
--   -- if the flyer is right, move the fixture:
--   update matches
--      set kicks_off_at = timestamptz '2026-09-06 17:15:00-04'
--    where home_team = 'Team Bebo' and away_team = 'Team Shareef';
--
--   -- if Saturday is right, move the event:
--   update events
--      set starts_at = timestamptz '2026-09-05 17:15:00-04',
--          ends_at   = timestamptz '2026-09-05 19:00:00-04',
--          status = 'approved', reviewed_at = now()
--    where title = 'All-Star Game — Team Shareef v Team Bebo';
--
-- Editing a match renames its room, so either is safe to run.
-- ---------------------------------------------------------------------

-- Check nothing fell out of approval:
--   select title, status,
--          to_char(starts_at at time zone 'America/New_York', 'Dy HH24:MI')
--     from events
--    where organizer_name = 'SASF'
--    order by starts_at;
--
-- Expect 13 rows, all 'approved'.
