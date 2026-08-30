"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { GateMatch } from "@/lib/queries/gate";

/**
 * The fixtures, as a schedule sheet.
 *
 * Four matches kick off together in every slot, so time is the real
 * structure of this weekend — not an attribute of each fixture but the
 * thing that groups them. Printing it once down the left, with the
 * matches ruled beneath it, is how the paper taped to a fence at a
 * tournament reads, and it's how someone actually scans for "what's on
 * at half nine".
 *
 * The earlier version was a stack of identical rounded cards, each
 * repeating its own time in a line of middle-dot metadata. That is a
 * layout that would suit any list of anything.
 */
export function GateMatchList({
  matches,
  signedIn,
}: {
  matches: GateMatch[];
  signedIn: boolean;
}) {
  // Grouped by kickoff, in order. Object key order is insertion order
  // for string keys, and the input is already sorted by time.
  const slots = useMemo(() => {
    const byTime = new Map<string, GateMatch[]>();
    for (const match of matches) {
      const list = byTime.get(match.kicks_off_at) ?? [];
      list.push(match);
      byTime.set(match.kicks_off_at, list);
    }
    return [...byTime.entries()];
  }, [matches]);

  if (slots.length === 0) return null;

  return (
    <div className="divide-y divide-stone-900/10">
      {slots.map(([kickoff, games]) => (
        <Slot
          key={kickoff}
          kickoff={kickoff}
          games={games}
          signedIn={signedIn}
        />
      ))}
    </div>
  );
}

function Slot({
  kickoff,
  games,
  signedIn,
}: {
  kickoff: string;
  games: GateMatch[];
  signedIn: boolean;
}) {
  const when = new Date(kickoff);
  const day = when.toLocaleDateString([], { weekday: "long" });
  const time = when
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    .toLowerCase();

  return (
    <section className="flex gap-4 py-4">
      {/* The time is printed once for the whole slot, because four
          matches share it. Repeating it on each row would be four
          copies of the same fact. */}
      <header className="w-16 shrink-0 pt-0.5">
        <p className="text-[15px] font-bold leading-none tabular-nums text-stone-900">
          {time}
        </p>
        <p className="mt-1 text-[11px] leading-none text-stone-500">{day}</p>
      </header>

      <div className="min-w-0 flex-1 space-y-3">
        {games.map((game) => (
          <Fixture key={game.id} match={game} signedIn={signedIn} />
        ))}
      </div>
    </section>
  );
}

function Fixture({
  match,
  signedIn,
}: {
  match: GateMatch;
  signedIn: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);

  const [open, setOpen] = useState(false);
  const [home, setHome] = useState(String(match.my_home ?? ""));
  const [away, setAway] = useState(String(match.my_away ?? ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<[number, number] | null>(
    match.my_home !== null ? [match.my_home, match.my_away ?? 0] : null
  );

  async function save() {
    const h = Number(home);
    const a = Number(away);
    if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0) {
      setError("Whole numbers only.");
      return;
    }
    if (h > 20 || a > 20) {
      setError("Twenty at most.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { error } = await supabase.rpc("make_prediction", {
        p_match: match.id,
        p_home: h,
        p_away: a,
      });

      if (error) {
        setError(
          error.message.includes("MATCH_CLOSED")
            ? "That one's closed now."
            : "Didn't save. Try again."
        );
        return;
      }

      // Shown immediately — a pick that takes a beat to appear reads as
      // one that didn't register.
      setSaved([h, a]);
      setOpen(false);
    } catch {
      setError("No connection. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const scoreBox =
    "w-14 rounded-md border-2 border-stone-900/15 bg-stone-0 py-2 text-center text-xl font-bold tabular-nums text-stone-900 focus:border-stone-900/40 focus:outline-none";

  return (
    <div>
      <div className="flex items-baseline gap-3">
        <div className="min-w-0 flex-1">
          {match.teams_announced ? (
            <p
              className="truncate text-[15px] font-semibold leading-snug text-stone-900"
              dir="auto"
            >
              {match.home_team}{" "}
              <span className="font-normal text-stone-400">v</span>{" "}
              {match.away_team}
            </p>
          ) : (
            <p className="text-[15px] font-medium leading-snug text-stone-400">
              Teams not drawn yet
            </p>
          )}

          {/* Only what isn't already obvious from position on the sheet:
              which field to stand at. */}
          {match.field_label && (
            <p className="mt-0.5 text-[11px] text-stone-500">
              {match.field_label}
              {match.group_label ? `, ${match.group_label}` : ""}
            </p>
          )}
        </div>

        {saved && !open && (
          <p className="shrink-0 text-[15px] font-bold tabular-nums text-emerald-800">
            {saved[0]}
            {"\u2013"}
            {saved[1]}
          </p>
        )}

        {!saved && !open && signedIn && match.teams_announced && (
          <button
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-md bg-amber-400 px-3 py-1 text-[13px] font-bold text-on-brand"
          >
            Pick
          </button>
        )}

        {saved && !open && signedIn && (
          <button
            onClick={() => setOpen(true)}
            className="shrink-0 text-[13px] font-medium text-stone-500 underline underline-offset-2"
          >
            Change
          </button>
        )}

        {!signedIn && match.teams_announced && (
          <Link
            href={`/signup?next=${encodeURIComponent("/gate")}`}
            className="shrink-0 rounded-md bg-amber-400 px-3 py-1 text-[13px] font-bold text-on-brand"
          >
            Pick
          </Link>
        )}
      </div>

      {open && signedIn && (
        <div className="mt-2.5">
          <div className="flex items-center gap-2">
            <input
              inputMode="numeric"
              value={home}
              onChange={(e) => setHome(e.target.value.replace(/\D/g, ""))}
              aria-label={`${match.home_team} score`}
              autoFocus
              className={scoreBox}
            />
            <input
              inputMode="numeric"
              value={away}
              onChange={(e) => setAway(e.target.value.replace(/\D/g, ""))}
              aria-label={`${match.away_team} score`}
              className={scoreBox}
            />

            <button
              onClick={save}
              disabled={saving || home === "" || away === ""}
              className="ml-1 rounded-md bg-emerald-800 px-4 py-2.5 text-[13px] font-bold text-stone-0 disabled:opacity-40"
            >
              {saving ? "Saving" : "Save"}
            </button>

            <button
              onClick={() => setOpen(false)}
              className="text-[13px] font-medium text-stone-500"
            >
              Cancel
            </button>
          </div>

          {error && (
            <p className="mt-1.5 text-[13px] text-red-700">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
