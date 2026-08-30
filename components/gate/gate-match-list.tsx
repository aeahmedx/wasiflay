"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCountdown, useCountdown } from "@/lib/hooks/use-now";
import type { GateMatch } from "@/lib/queries/gate";

const ROUND_LABEL: Record<string, string> = {
  group: "Group stage",
  quarter: "Quarter-final",
  semi: "Semi-final",
  final: "Final",
};

/** Sat 8:00 AM — enough to plan a day around, in the reader's own time. */
function whenLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString([], { weekday: "short" })} ${d.toLocaleTimeString(
    [],
    { hour: "numeric", minute: "2-digit" }
  )}`;
}

/**
 * The fixtures on the gate, each pickable in place.
 *
 * More than one match is the difference between a page someone visits
 * once and a page they come back to — but only if picking all of them
 * is a single sitting. Tapping into a match page and back for each
 * one is enough friction that people do the first and stop.
 */
export function GateMatchList({
  matches,
  signedIn,
}: {
  matches: GateMatch[];
  signedIn: boolean;
}) {
  if (matches.length === 0) return null;

  return (
    <ul className="mt-3 space-y-2">
      {matches.map((match) => (
        <li key={match.id}>
          <GateMatchRow match={match} signedIn={signedIn} />
        </li>
      ))}
    </ul>
  );
}

function GateMatchRow({
  match,
  signedIn,
}: {
  match: GateMatch;
  signedIn: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const left = useCountdown(match.kicks_off_at);

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

    /**
     * The RPC reports failure by returning an error, not by throwing —
     * so it's read directly. Throwing it to catch it two lines later
     * would be a detour that hides where the failure came from.
     *
     * try/catch still wraps the call itself, because the network can
     * fail before the RPC ever answers.
     */
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

  const numberField =
    "w-16 rounded-lg border border-stone-300 bg-stone-0 px-2 py-2 text-center text-lg font-semibold tabular-nums text-stone-900";

  return (
    <div className="rounded-lg border border-stone-200 bg-stone-0 px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 flex-1 font-semibold leading-tight text-stone-900" dir="auto">
          {match.teams_announced ? (
            <>
              {match.home_team} <span className="text-stone-400">v</span>{" "}
              {match.away_team}
            </>
          ) : (
            <span className="text-stone-500">Teams announced soon</span>
          )}
        </p>

        {left !== null && left > 0 && (
          <span className="shrink-0 text-xs font-medium tabular-nums text-stone-500">
            {formatCountdown(left)}
          </span>
        )}
      </div>

      {/* Group and field make it legible as part of a real tournament,
          which is most of what makes a guess feel worth making. */}
      <p className="mt-0.5 text-xs text-stone-500">
        {match.group_label ?? ROUND_LABEL[match.round] ?? match.round}
        {match.field_label ? ` · ${match.field_label}` : ""}
        {" · "}
        {whenLabel(match.kicks_off_at)}
        {match.prediction_count >= 5 && ` · ${match.prediction_count} picks`}
      </p>

      {open && signedIn ? (
        <div className="mt-3">
          <div className="flex items-center justify-center gap-3">
            <input
              inputMode="numeric"
              value={home}
              onChange={(e) => setHome(e.target.value.replace(/\D/g, ""))}
              aria-label={`${match.home_team} score`}
              className={numberField}
            />
            <span className="text-stone-400">{"\u2013"}</span>
            <input
              inputMode="numeric"
              value={away}
              onChange={(e) => setAway(e.target.value.replace(/\D/g, ""))}
              aria-label={`${match.away_team} score`}
              className={numberField}
            />
          </div>

          {error && (
            <p className="mt-2 text-center text-sm text-red-700">{error}</p>
          )}

          <div className="mt-3 flex gap-2">
            <button
              onClick={save}
              disabled={saving || home === "" || away === ""}
              className="flex-1 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-stone-0 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save pick"}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm text-stone-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2.5 flex items-center gap-2">
          {saved && (
            <span className="rounded-full bg-stone-100 px-3 py-1 text-sm font-medium tabular-nums text-stone-800">
              You said {saved[0]}
              {"\u2013"}
              {saved[1]}
            </span>
          )}

          {!signedIn ? (
            <Link
              href={`/signup?next=${encodeURIComponent("/gate")}`}
              className="ml-auto rounded-full bg-amber-400 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-on-brand"
            >
              Predict
            </Link>
          ) : !match.teams_announced ? (
            <span className="ml-auto text-xs text-stone-500">
              Pick when teams drop
            </span>
          ) : (
            <button
              onClick={() => setOpen(true)}
              className={`ml-auto rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide ${
                saved
                  ? "bg-stone-100 text-stone-700"
                  : "bg-amber-400 text-on-brand"
              }`}
            >
              {saved ? "Change" : "Predict"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
