import type { Metadata } from "next";
import Link from "next/link";
import { OG_IMAGE } from "@/lib/og";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profiles.server";
import {
  getLeaderboard,
  getMatches,
  getMyStanding,
  ROUND_LABEL,
  ROUND_MULTIPLIER,
  type LeaderRow,
  type Match,
  type Standing,
} from "@/lib/queries/predictions";
import { LiveRefresh } from "@/components/live-refresh";
import { MatchRow } from "@/components/matches/match-row";
import { LocalTime } from "@/components/matches/local-time";
import { Wordmark } from "@/components/wordmark";

export const metadata: Metadata = {
  title: "Tournament",
  description:
    "Every match, the bracket, the leaderboard and the rooms — the whole weekend in one place.",
  openGraph: {
    type: "website",
    url: "https://www.wasiflay.com/hub",
    siteName: "Wasif Lay",
    images: [OG_IMAGE],
    title: "Wasif Lay · 2026 Tournament Experience",
    description:
      "Every match, the bracket, the leaderboard and the rooms — the whole weekend in one place.",
  },
};

/** A day's fixtures, and within it the kickoff slots. */
type Slot = { kickoff: string; matches: Match[] };
type Day = { label: string; iso: string; slots: Slot[] };

/**
 * Groups fixtures by calendar day, then by kickoff.
 *
 * Four fields run at once, so a kickoff is a slot of four rather than a
 * single match — grouping that way is what makes a 31-fixture schedule
 * readable on a phone instead of an endless list.
 *
 * Uses the New York zone explicitly. The tournament happens there, and
 * a visitor in Khartoum reading "Sunday" for a Saturday match would be
 * looking at a different tournament to everyone around them.
 */
function groupByDay(matches: Match[]): Day[] {
  const days = new Map<string, Day>();

  for (const match of matches) {
    const when = new Date(match.kicks_off_at);
    if (Number.isNaN(when.getTime())) continue;

    const dayKey = when.toLocaleDateString("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    let day = days.get(dayKey);
    if (!day) {
      day = {
        label: when.toLocaleDateString("en-US", {
          timeZone: "America/New_York",
          weekday: "long",
          month: "long",
          day: "numeric",
        }),
        iso: match.kicks_off_at,
        slots: [],
      };
      days.set(dayKey, day);
    }

    const slot = day.slots.find((s) => s.kickoff === match.kicks_off_at);
    if (slot) {
      slot.matches.push(match);
    } else {
      day.slots.push({ kickoff: match.kicks_off_at, matches: [match] });
    }
  }

  return [...days.values()];
}

function scoreline(match: Match): string {
  if (match.home_score === null || match.away_score === null) return "";
  return `${match.home_score}\u2013${match.away_score}`;
}

/**
 * The whole weekend, on one screen.
 *
 * Everything here is read from fixtures that already exist. There is no
 * separate hub data: what's playing, what's next, the full schedule,
 * the knockout bracket and the board are all views of the same 31 rows,
 * which is what keeps them from ever disagreeing with each other.
 */
export default async function HubPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  let matches: Match[] = [];
  let standing: Standing | null = null;
  let leaders: LeaderRow[] = [];
  let loadFailed = false;

  /**
   * One failed query used to take the whole page down.
   *
   * These calls throw by design, and that is right for callers who need
   * to know. Here it is not: a transient rejection — a clock-skewed
   * token, a dropped connection at a pitch on one bar of signal — would
   * replace the entire tournament with an error screen. A retry line is
   * a better answer than a stack trace, and whatever did arrive still
   * renders.
   */
  try {
    const [loadedMatches, loadedStanding, loadedLeaders] = await Promise.all([
      getMatches(supabase, 60),
      profile ? getMyStanding(supabase) : Promise.resolve(null),
      getLeaderboard(supabase, 5),
    ]);

    matches = loadedMatches;
    standing = loadedStanding;
    leaders = loadedLeaders;
  } catch {
    loadFailed = true;
  }

  const now = Date.now();

  const live = matches.filter(
    (m) =>
      m.status !== "cancelled" &&
      m.status !== "finished" &&
      new Date(m.kicks_off_at).getTime() <= now
  );

  const upcoming = matches.filter(
    (m) => m.status !== "cancelled" && new Date(m.kicks_off_at).getTime() > now
  );

  const finished = matches.filter((m) => m.status === "finished");

  const nextKickoff = upcoming[0]?.kicks_off_at ?? null;
  const nextSlot = nextKickoff
    ? upcoming.filter((m) => m.kicks_off_at === nextKickoff)
    : [];

  const days = groupByDay(
    matches.filter((m) => m.status !== "cancelled")
  );

  const knockout = matches.filter(
    (m) => m.round !== "group" && m.status !== "cancelled"
  );

  const quarters = knockout.filter((m) => m.round === "quarter");
  const semis = knockout.filter((m) => m.round === "semi");
  const final = knockout.find((m) => m.round === "final") ?? null;

  const picked = matches.filter((m) => m.my_home !== null).length;
  const pickable = matches.filter((m) => m.is_open).length;

  return (
    <main className="min-h-dvh bg-stone-50 pb-safe-page">
      {/* Realtime on both tables, with the 15s poll behind it: a result
          entered at the field has to reach a phone in the crowd without
          anyone pulling to refresh. */}
      <LiveRefresh watch={[{ table: "matches" }, { table: "predictions" }]} />

      {/* --- masthead ------------------------------------------------ */}
      <header className="bg-amber-400 px-4 pb-5 pt-6">
        <div className="mx-auto max-w-md">
          <Wordmark size="md" priority />
          <h1 className="mt-3 text-[1.75rem] font-black leading-tight tracking-tight text-on-brand">
            2026 Tournament
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-on-brand opacity-80">
            Thirty-one matches over two days. Call every score, argue in
            the rooms, finish top of a board nobody has ever topped.
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-stone-0/90 px-2 py-2 text-center">
              <p className="text-xl font-bold tabular-nums leading-none text-stone-900">
                {finished.length}
              </p>
              <p className="mt-0.5 text-[11px] text-stone-600">Played</p>
            </div>
            <div className="rounded-lg bg-stone-0/90 px-2 py-2 text-center">
              <p className="text-xl font-bold tabular-nums leading-none text-stone-900">
                {live.length}
              </p>
              <p className="mt-0.5 text-[11px] text-stone-600">On now</p>
            </div>
            <div className="rounded-lg bg-stone-0/90 px-2 py-2 text-center">
              <p className="text-xl font-bold tabular-nums leading-none text-stone-900">
                {upcoming.length}
              </p>
              <p className="mt-0.5 text-[11px] text-stone-600">To come</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-6 px-4 pt-5">
        {loadFailed && (
          <section
            role="status"
            className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3.5"
          >
            <p className="font-semibold text-stone-900">
              Couldn&apos;t load the tournament
            </p>
            <p className="mt-1 text-sm leading-relaxed text-stone-700">
              Usually a bad moment of signal. Pull down to refresh, or open
              this again in a few seconds.
            </p>
          </section>
        )}

        {/* --- where you stand --------------------------------------- */}
        {profile && standing && standing.played > 0 && (
          <section className="rounded-lg border border-emerald-800 bg-emerald-50 px-4 py-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <p className="text-sm text-emerald-900">You are</p>
                <p className="text-2xl font-bold tabular-nums leading-tight text-emerald-950">
                  {standing.rank === 1
                    ? `Top of ${standing.total}`
                    : `${standing.rank} of ${standing.total}`}
                </p>
              </div>
              <p className="text-right text-sm text-emerald-900">
                {standing.points} {standing.points === 1 ? "point" : "points"}
                {standing.exact_count > 0 && (
                  <>
                    <br />
                    {standing.exact_count} exact
                  </>
                )}
              </p>
            </div>
            {standing.gap_above > 0 && (
              <p className="mt-1.5 text-sm text-emerald-900">
                {standing.gap_above} behind the place above.
              </p>
            )}
          </section>
        )}

        {profile && picked === 0 && pickable > 0 && (
          <section className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3.5">
            <p className="font-semibold text-stone-900">
              You haven&apos;t picked anything yet
            </p>
            <p className="mt-1 text-sm leading-relaxed text-stone-700">
              {pickable} {pickable === 1 ? "match is" : "matches are"} still
              open. Exact score is worth 10, and the final is worth triple.
            </p>
          </section>
        )}

        {!profile && (
          <section className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3.5">
            <p className="font-semibold text-stone-900">
              Nobody has ever won this
            </p>
            <p className="mt-1 text-sm leading-relaxed text-stone-700">
              It&apos;s the first year there&apos;s a board. Whoever tops it
              is the first name on it.
            </p>
            <Link
              replace
              href={`/signup?next=${encodeURIComponent("/hub")}`}
              className="mt-2.5 block rounded-lg bg-emerald-800 px-4 py-2.5 text-center font-semibold text-stone-0"
            >
              Sign up and start picking
            </Link>
          </section>
        )}

        {/* --- playing now -------------------------------------------- */}
        {live.length > 0 && (
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-stone-700">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full bg-red-600"
              />
              {live.length === 1 ? "Playing now" : `${live.length} playing now`}
            </h2>
            <ul className="space-y-2">
              {live.map((match) => (
                <li key={match.id}>
                  <div className="rounded-lg border border-stone-200 bg-stone-0 px-3.5 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <Link
                        href={`/matches/${match.id}`}
                        className="min-w-0 flex-1 font-semibold leading-snug text-stone-900 underline decoration-stone-400 underline-offset-4"
                        dir="auto"
                      >
                        {match.home_team} v {match.away_team}
                      </Link>
                      {match.room_slug && (
                        <Link
                          href={`/rooms/${match.room_slug}`}
                          className="shrink-0 rounded-full bg-emerald-800 px-3 py-1 text-sm font-medium text-stone-0"
                        >
                          Room
                        </Link>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-stone-600">
                      {ROUND_LABEL[match.round]}
                      {match.my_home !== null && (
                        <>
                          {" · you said "}
                          {match.my_home}
                          {"\u2013"}
                          {match.my_away}
                        </>
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* --- next up ------------------------------------------------ */}
        {live.length === 0 && nextSlot.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-700">
              Next up
            </h2>
            <p className="mb-2 text-sm text-stone-600">
              <LocalTime iso={nextSlot[0].kicks_off_at} />
            </p>
            <ul className="space-y-2">
              {nextSlot.map((match) => (
                <li key={match.id}>
                  <MatchRow match={match} userId={profile?.id ?? null} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* --- how it works ------------------------------------------- */}
        <section className="rounded-lg border border-stone-200 bg-stone-0 px-4 py-4">
          <h2 className="font-semibold text-stone-900">How the picks work</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-stone-700">
            Call the score of every match before it kicks off. You get the
            best result you qualify for, not the sum.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-stone-700">
            <li className="flex justify-between gap-3">
              <span>Exact score</span>
              <span className="font-semibold tabular-nums text-stone-900">
                10
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span>Right winner and margin</span>
              <span className="font-semibold tabular-nums text-stone-900">
                6
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span>Right winner</span>
              <span className="font-semibold tabular-nums text-stone-900">
                4
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span>Right total goals</span>
              <span className="font-semibold tabular-nums text-stone-900">
                2
              </span>
            </li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed text-stone-700">
            Later rounds are worth more: quarter-finals{" "}
            <span className="font-semibold">
              ×{ROUND_MULTIPLIER.quarter}
            </span>
            , semi-finals{" "}
            <span className="font-semibold">×{ROUND_MULTIPLIER.semi}</span>,
            the final{" "}
            <span className="font-semibold">×{ROUND_MULTIPLIER.final}</span>.
            An exact score in the final is 30 on its own, so nobody is out
            of it on Sunday.
          </p>
          <Link
            href="/rules"
            className="mt-3 inline-block text-sm text-stone-700 underline underline-offset-4"
          >
            Full rules
          </Link>
        </section>

        {/* --- the bracket -------------------------------------------- */}
        {knockout.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-700">
              The bracket
            </h2>
            <div className="space-y-4 rounded-lg border border-stone-200 bg-stone-0 px-4 py-4">
              {quarters.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                    Quarter-finals
                  </p>
                  <ul className="space-y-1.5">
                    {quarters.map((match) => (
                      <li key={match.id}>
                        <Link
                          href={`/matches/${match.id}`}
                          className="flex items-baseline justify-between gap-3 rounded border-l-2 border-stone-300 py-1 pl-2.5"
                        >
                          <span
                            className="min-w-0 flex-1 text-sm text-stone-800"
                            dir="auto"
                          >
                            {match.home_team} v {match.away_team}
                          </span>
                          <span className="shrink-0 text-sm font-semibold tabular-nums text-stone-900">
                            {scoreline(match)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {semis.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                    Semi-finals
                  </p>
                  <ul className="space-y-1.5">
                    {semis.map((match) => (
                      <li key={match.id}>
                        <Link
                          href={`/matches/${match.id}`}
                          className="flex items-baseline justify-between gap-3 rounded border-l-2 border-amber-400 py-1 pl-2.5"
                        >
                          <span
                            className="min-w-0 flex-1 text-sm text-stone-800"
                            dir="auto"
                          >
                            {match.home_team} v {match.away_team}
                          </span>
                          <span className="shrink-0 text-sm font-semibold tabular-nums text-stone-900">
                            {scoreline(match)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {final && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                    Final
                  </p>
                  <Link
                    href={`/matches/${final.id}`}
                    className="flex items-baseline justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2.5"
                  >
                    <span
                      className="min-w-0 flex-1 font-semibold text-stone-900"
                      dir="auto"
                    >
                      {final.home_team} v {final.away_team}
                    </span>
                    <span className="shrink-0 font-bold tabular-nums text-stone-900">
                      {scoreline(final)}
                    </span>
                  </Link>
                </div>
              )}
            </div>
          </section>
        )}

        {/* --- the board ---------------------------------------------- */}
        {leaders.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-700">
              Leaderboard
            </h2>
            <ul className="divide-y divide-stone-200 overflow-hidden rounded-lg border border-stone-200 bg-stone-0">
              {leaders.map((row) => (
                <li
                  key={row.user_id}
                  className={`flex items-center gap-3 px-3.5 py-2.5 ${
                    row.is_me ? "bg-emerald-50" : ""
                  }`}
                >
                  <span className="w-5 shrink-0 text-sm font-semibold tabular-nums text-stone-500">
                    {row.rank}
                  </span>
                  <Link
                    href={`/profile/${row.user_id}`}
                    className="min-w-0 flex-1 truncate text-sm font-medium text-stone-900"
                    dir="auto"
                  >
                    {row.display_name}
                  </Link>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-stone-900">
                    {row.points}
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href="/leaderboard"
              className="mt-2 inline-block text-sm text-stone-700 underline underline-offset-4"
            >
              Full leaderboard
            </Link>
          </section>
        )}

        {/* --- the whole schedule ------------------------------------- */}
        {days.map((day) => (
          <section key={day.iso}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-700">
              {day.label}
            </h2>
            <div className="space-y-4">
              {day.slots.map((slot) => (
                <div key={slot.kickoff}>
                  <p className="mb-1.5 text-sm font-medium text-stone-600">
                    <LocalTime iso={slot.kickoff} />
                  </p>
                  <ul className="space-y-2">
                    {slot.matches.map((match) => (
                      <li key={match.id}>
                        <MatchRow
                          match={match}
                          userId={profile?.id ?? null}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))}

        {days.length === 0 && !loadFailed && (
          <p className="rounded-lg border border-stone-200 bg-stone-0 px-4 py-8 text-center text-stone-500">
            Fixtures go up here as soon as the schedule lands.
          </p>
        )}

        {/* --- where else to go --------------------------------------- */}
        <section className="grid grid-cols-2 gap-2 pb-2">
          <Link
            href="/rooms"
            className="rounded-lg border border-stone-300 bg-stone-0 px-4 py-3 text-center font-medium text-stone-900"
          >
            Match rooms
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-stone-300 bg-stone-0 px-4 py-3 text-center font-medium text-stone-900"
          >
            Community
          </Link>
        </section>
      </div>
    </main>
  );
}
