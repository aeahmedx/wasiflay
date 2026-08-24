"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MatchClosedError, predict, type Match } from "@/lib/queries/predictions";

const MAX = 20;

function Stepper({
  label,
  value,
  onChangeAction,
}: {
  label: string;
  value: number;
  onChangeAction: (n: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span
        className="max-w-[7.5rem] truncate text-xs text-stone-600"
        dir="auto"
      >
        {label}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`One fewer for ${label}`}
          onClick={() => onChangeAction(Math.max(0, value - 1))}
          className="h-9 w-9 rounded-full border border-stone-300 text-lg text-stone-700"
        >
          −
        </button>
        <span className="w-8 text-center text-2xl font-semibold tabular-nums text-stone-900">
          {value}
        </span>
        <button
          type="button"
          aria-label={`One more for ${label}`}
          onClick={() => onChangeAction(Math.min(MAX, value + 1))}
          className="h-9 w-9 rounded-full border border-stone-300 text-lg text-stone-700"
        >
          +
        </button>
      </div>
    </div>
  );
}

/**
 * Two steppers and a button. Fifteen seconds, no keyboard.
 *
 * Steppers rather than number inputs on purpose: a numeric keyboard
 * covers half a phone screen and turns a fifteen-second action into a
 * form. Scores are almost always under five, so tapping is faster than
 * typing anyway.
 */
export function PredictForm({
  match,
  onDoneAction,
}: {
  match: Match;
  /** Called with the saved values so the caller can show them straight
   *  away — router.refresh() is a round trip, and a pick that takes a
   *  beat to appear feels like it didn't register. */
  onDoneAction?: (home: number, away: number) => void;
}) {
  const router = useRouter();
  const [home, setHome] = useState(match.my_home ?? 1);
  const [away, setAway] = useState(match.my_away ?? 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed = home !== match.my_home || away !== match.my_away;
  const existing = match.my_home !== null;

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await predict(createClient(), match.id, home, away);
      // Tell the parent first, then reconcile with the server behind it.
      onDoneAction?.(home, away);
      router.refresh();
    } catch (e) {
      // The raw message is shown while we're the ones testing. A
      // friendly fallback that hides the reason makes a bug
      // undiagnosable — worth softening again before launch.
      const raw = e instanceof Error ? e.message : "";
      setError(
        e instanceof MatchClosedError
          ? "This one's kicked off — picks are closed."
          : raw
          ? `Couldn't save: ${raw}`
          : "Couldn't save your pick. Try again."
      );
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-stone-300 bg-stone-0 px-4 py-4">
      <div className="flex items-start justify-center gap-5">
        <Stepper label={match.home_team} value={home} onChangeAction={setHome} />
        <span className="mt-6 text-stone-400">–</span>
        <Stepper label={match.away_team} value={away} onChangeAction={setAway} />
      </div>

      {error && (
        <p role="alert" className="mt-3 text-center text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        onClick={save}
        disabled={saving || (existing && !changed)}
        className="mt-4 w-full rounded-lg bg-emerald-800 px-4 py-3 font-medium text-stone-0 disabled:opacity-40"
      >
        {saving
          ? "Saving…"
          : existing
          ? changed
            ? "Change my pick"
            : "Saved"
          : "Lock it in"}
      </button>

      <p className="mt-2 text-center text-xs text-stone-500">
        {existing
          ? "You can change this until kickoff."
          : "Exact score is worth the most. You can change it until kickoff."}
      </p>
    </div>
  );
}
