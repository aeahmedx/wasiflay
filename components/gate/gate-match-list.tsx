"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addPendingPick } from "@/lib/pending-picks";
import type { GateMatch } from "@/lib/queries/gate";

/**
 * The fixtures, as a schedule sheet.
 *
 * Four matches kick off together in every slot, so time is the real
 * structure of this weekend — not an attribute of each fixture but the
 * thing that groups them. Printed once down the left with the matches
 * ruled beneath it, the way the paper taped to a fence reads.
 */
export function GateMatchList({
  matches,
  signedIn,
  onPickedAction,
}: {
  matches: GateMatch[];
  signedIn: boolean;
  /** Fired when a signed-out visitor saves a pick, so the button
   *  below can wake up. */
  onPickedAction?: () => void;
}) {
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
          onPickedAction={onPickedAction}
        />
      ))}
    </div>
  );
}

function Slot({
  kickoff,
  games,
  signedIn,
  onPickedAction,
}: {
  kickoff: string;
  games: GateMatch[];
  signedIn: boolean;
  onPickedAction?: () => void;
}) {
  const when = new Date(kickoff);
  const day = when.toLocaleDateString([], { weekday: "short" });

  // Split so the time can never wrap: "8:00" is the number, "am" rides
  // beneath it with the day. A rail that reflows stops being a rail.
  const clock = when
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    .replace(/\s*[AP]M$/i, "");
  const meridiem = when.getHours() < 12 ? "am" : "pm";

  return (
    <section className="flex gap-3.5 py-4">
      <header className="w-[3.25rem] shrink-0 pt-px">
        <p className="text-[17px] font-bold leading-none tabular-nums text-stone-900">
          {clock}
        </p>
        <p className="mt-1 text-[11px] leading-tight text-stone-500">
          {meridiem}
          <br />
          {day}
        </p>
      </header>

      <div className="min-w-0 flex-1 space-y-3.5">
        {games.map((game) => (
          <Fixture
            key={game.id}
            match={game}
            signedIn={signedIn}
            onPickedAction={onPickedAction}
          />
        ))}
      </div>
    </section>
  );
}

function Fixture({
  match,
  signedIn,
  onPickedAction,
}: {
  match: GateMatch;
  signedIn: boolean;
  onPickedAction?: () => void;
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

    /**
     * Not signed in: keep the pick here and show it saved.
     *
     * Sending someone off to sign up the moment someone types a score
     * interrupts them mid-thought — they came to pick, not to make an
     * account. So the picks accumulate on the page and the account
     * comes once, at the bottom, when they have finished.
     */
    if (!signedIn) {
      addPendingPick({ matchId: match.id, home: h, away: a });
      setSaved([h, a]);
      setOpen(false);
      onPickedAction?.();
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
    "w-[3.25rem] rounded-md border-2 border-stone-900/15 bg-stone-0 py-1.5 text-center text-xl font-bold tabular-nums text-stone-900 focus:border-stone-900/40 focus:outline-none";

  return (
    <div>
      {/*
        The fixture gets the full width and is allowed to wrap.
        "Washington D.C. v Pennsylvania" beside a score and a button is
        three things competing for a phone's width, and the team names
        lose — which is the one thing on the row nobody can afford to
        have truncated.
      */}
      {match.teams_announced ? (
        <p
          className="text-[15px] font-semibold leading-snug text-stone-900"
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

      {match.field_label && (
        <p className="mt-0.5 text-[11px] text-stone-500">
          {match.field_label}
          {match.group_label ? `, ${match.group_label}` : ""}
        </p>
      )}

      {open ? (
        <div className="mt-2">
          {/* Wraps rather than overflowing: on a narrow phone the
              buttons drop to a second line instead of Cancel sliding
              off the edge. */}
          <div className="flex flex-wrap items-center gap-2">
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
              className="rounded-md bg-emerald-800 px-4 py-2 text-[13px] font-bold text-stone-0 disabled:opacity-40"
            >
              {saving ? "Saving" : signedIn ? "Save" : "Save my pick"}
            </button>

            <button
              onClick={() => setOpen(false)}
              className="px-1 text-[13px] font-medium text-stone-500"
            >
              Cancel
            </button>
          </div>

          {error && <p className="mt-1.5 text-[13px] text-red-700">{error}</p>}
        </div>
      ) : (
        <div className="mt-1.5 flex items-center gap-3">
          {saved && (
            <p className="text-[17px] font-bold leading-none tabular-nums text-emerald-800">
              {saved[0]}
              {"\u2013"}
              {saved[1]}
            </p>
          )}

          {match.teams_announced && !saved && (
            <button
              onClick={() => setOpen(true)}
              className="rounded-md bg-amber-400 px-3 py-1 text-[13px] font-bold text-on-brand"
            >
              Pick
            </button>
          )}

          {saved && (
            <button
              onClick={() => setOpen(true)}
              className="text-[13px] font-medium text-stone-500 underline underline-offset-2"
            >
              Change
            </button>
          )}

          {!match.teams_announced && (
            <p className="text-[13px] text-stone-400">Pick when they drop</p>
          )}
        </div>
      )}
    </div>
  );
}
