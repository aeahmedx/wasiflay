import type { Metadata } from "next";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { createClient } from "@/lib/supabase/server";
import { getGateState } from "@/lib/queries/gate";
import { SUPPORT_EMAIL } from "@/lib/legal";
import { OG_IMAGE } from "@/lib/og";

export const metadata: Metadata = {
  title: "How the predictions work",
  description:
    "Predict the score, earn points, top the board. Free to play, no money involved.",
  openGraph: {
    images: [OG_IMAGE],
    title: "How the predictions work · Wasif Lay",
    description:
      "Predict the score, earn points, top the board. Free to play, no money involved.",
  },
};

const LADDER = [
  { what: "Exact score", pts: 10, eg: "You said 3–1, it finished 3–1" },
  { what: "Right winner and margin", pts: 6, eg: "You said 2–0, it finished 3–1" },
  { what: "Right winner", pts: 4, eg: "You said 4–1, it finished 3–1" },
  { what: "Right total goals", pts: 2, eg: "You said 1–3, it finished 3–1" },
  { what: "Nothing right", pts: 0, eg: "" },
];

const ROUNDS = [
  { round: "Group stage", mult: "×1" },
  { round: "Quarter-finals", mult: "×1.5" },
  { round: "Semi-finals", mult: "×2" },
  { round: "Final", mult: "×3" },
];

export default async function RulesPage() {
  /**
   * While the gate is up, matches and the leaderboard bounce straight
   * back to it — so linking to them here would be a door that opens
   * onto the door you came through. They appear the moment the app
   * does.
   */
  const supabase = await createClient();
  const { is_open: appOpen } = await getGateState(supabase);

  return (
    <main className="min-h-dvh bg-stone-50 px-4 pt-6 pb-safe-page">
      <article className="mx-auto max-w-md">
        <BackLink />

        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
          How the predictions work
        </h1>

        <p className="mt-3 text-stone-800 leading-relaxed">
          Nobody has ever won this. Whoever tops the board this weekend
          takes $250 and goes down as the first name on it — the first
          champion of the first tournament, before anyone else knew this
          existed. Call the scores, watch the games, argue in the rooms.
        </p>

        <div className="mt-6 space-y-6 text-stone-800 leading-relaxed">
          <section>
            <h2 className="font-semibold text-stone-900">Playing</h2>
            <p className="mt-1.5">
              Predict the score of any match before it kicks off. You can
              change your mind as many times as you like until then. Once a
              match starts, picks lock and everyone&apos;s becomes visible
              at once — so nobody can wait and copy.
            </p>
            <p className="mt-1.5">
              You can join at any point. Miss Saturday morning and you can
              still pick Saturday afternoon; later rounds are worth more,
              so the board is never settled early.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900">Points</h2>
            <p className="mt-1.5">
              You get the best result you qualify for, not the sum.
            </p>
            <ul className="mt-3 space-y-2">
              {LADDER.map((row) => (
                <li
                  key={row.what}
                  className="flex items-start gap-3 rounded-lg border border-stone-200 bg-stone-0 px-3 py-2.5"
                >
                  <span className="w-8 shrink-0 text-right font-semibold tabular-nums text-stone-900">
                    {row.pts}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-stone-900">
                      {row.what}
                    </span>
                    {row.eg && (
                      <span className="block text-xs text-stone-500">
                        {row.eg}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-stone-600">
              Predicting a draw counts the same way — the exact score is
              worth 10, any other draw is worth 6, because calling the draw
              is the hard part.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900">Later rounds count more</h2>
            <ul className="mt-2 space-y-1">
              {ROUNDS.map((r) => (
                <li key={r.round} className="flex items-center gap-3 text-sm">
                  <span className="w-14 shrink-0 font-semibold tabular-nums text-stone-900">
                    {r.mult}
                  </span>
                  <span className="text-stone-700">{r.round}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-stone-600">
              An exact score in the final is worth 30. Someone who starts on
              Sunday can still win.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900">Ties</h2>
            <p className="mt-1.5">Settled in this order, automatically:</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-5">
              <li>Most exact scores</li>
              <li>Most matches predicted</li>
              <li>Whoever committed earliest on average</li>
              <li>Oldest account</li>
            </ol>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900">
              The prize, and the one rule
            </h2>
            <p className="mt-1.5">
              $250 to whoever is top of the board once the final is
              scored. Free to enter — there is no fee, no stake and
              nothing to buy.
            </p>
            <p className="mt-1.5">
              If two people finish level on points, the tiebreakers decide
              it in this order: most exact scores, then most matches
              predicted, then whoever committed earliest. Those are the
              same tiebreakers the board has always used, so you can see
              where you stand before the final rather than after it.
            </p>
            <p className="mt-1.5">
              You need an account, and it needs a real name we can contact
              you on. One person, one account — anyone found running
              several forfeits the prize.
            </p>
            <p className="mt-1.5">
              <strong>
                Betting or taking wagers on anything here — matches,
                predictions, the leaderboard — means a permanent ban.
              </strong>{" "}
              Not a warning, not a suspension. That includes running a pool,
              collecting money for a pot, or advertising odds in the rooms
              or the feed. Report it if you see it.
            </p>
            <p className="mt-1.5 text-sm text-stone-600">
              This is not negotiable and it is not about being strict for
              the sake of it. Young people use Wasif Lay, gambling
              regulations exist for good reasons, and one person doing this
              would put the whole platform at risk.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900">The boring part</h2>
            <p className="mt-1.5 text-sm text-stone-600">
              Wasif Lay is not affiliated with, endorsed by or run by the
              tournament organisers. Match times and results are entered by
              hand and can be corrected if they are wrong — corrections
              rescore everyone fairly. Matches can be added, moved or
              removed as the schedule changes. The $250 is offered free
              to enter, with no stake and no consideration of any kind —
              it is a prize for predicting well, not a wager.
            </p>
            <p className="mt-1.5 text-sm text-stone-600">
              Anything unclear or unfair, email{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-emerald-800 underline underline-offset-4"
              >
                {SUPPORT_EMAIL}
              </a>{" "}
              and it gets looked at.
            </p>
          </section>
        </div>

        <div className="mt-8 flex flex-wrap gap-4 border-t border-stone-200 pt-5 text-sm">
          {appOpen && (
            <>
              <Link
                href="/matches"
                className="text-emerald-800 underline underline-offset-4"
              >
                Matches
              </Link>
              <Link
                href="/leaderboard"
                className="text-emerald-800 underline underline-offset-4"
              >
                Leaderboard
              </Link>
            </>
          )}
          <Link
            href="/guidelines"
            className="text-emerald-800 underline underline-offset-4"
          >
            Community guidelines
          </Link>
        </div>
      </article>
    </main>
  );
}
