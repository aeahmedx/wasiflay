"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  setFeaturedMatch,
  setGate,
  setGateReveal,
  type GateReveal,
  type GateState,
} from "@/lib/queries/gate";
import { getStaffMatches, type StaffMatch } from "@/lib/queries/predictions";

const input =
  "w-full rounded-lg border border-stone-300 bg-stone-0 px-3 py-2.5 text-stone-900";

/** datetime-local wants local wall-clock time, not an ISO string. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * The gate, from the moderation panel.
 *
 * Three controls, in the order they matter: when it opens, which match
 * is on the front, and a switch to open it now if the clock is wrong or
 * something needs fixing in front of people.
 */
export function GateControls({
  initial,
  reveal,
}: {
  initial: GateState;
  /** How many fixtures the gate is showing, and how many exist. */
  reveal: GateReveal;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [opensAt, setOpensAt] = useState(toLocalInput(initial.opens_at));
  const [matches, setMatches] = useState<StaffMatch[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  /**
   * Loaded when the picker is first opened rather than on mount.
   *
   * An effect that starts a state update costs an extra render pass
   * before paint, and this list is only needed the moment someone
   * touches the dropdown — which on this panel is rare.
   */
  async function loadMatches() {
    if (matches.length > 0 || loadingMatches) return;
    setLoadingMatches(true);
    try {
      setMatches(await getStaffMatches(supabase));
    } catch {
      // The picker stays empty; nothing else depends on it.
    } finally {
      setLoadingMatches(false);
    }
  }

  /**
   * The three controls did the same six lines around a different call —
   * busy on, clear the notice, do the thing, refresh, say what happened,
   * busy off. Once, here.
   */
  async function run<T>(
    action: () => Promise<T>,
    said: (result: T) => string,
    failed: string
  ) {
    setBusy(true);
    setNotice(null);
    try {
      const result = await action();
      router.refresh();
      setNotice(said(result));
    } catch {
      setNotice(failed);
    } finally {
      setBusy(false);
    }
  }

  function saveTime() {
    void run(
      () =>
        setGate(
          supabase,
          opensAt ? new Date(opensAt).toISOString() : null,
          initial.forced
        ),
      (open) =>
        !opensAt
          ? "No gate — the app is open to everyone."
          : open
          ? "That time has passed, so the app is open."
          : "Saved. The app is closed until then.",
      "Couldn't save that."
    );
  }

  function toggleForce() {
    void run(
      () => setGate(supabase, initial.opens_at, !initial.forced),
      () =>
        initial.forced
          ? "Back on the clock."
          : "Forced open. The countdown is ignored until you switch this off.",
      "Couldn't change that."
    );
  }

  /**
   * How many fixtures appear on the gate.
   *
   * The reason a countdown page gets a second visit. One on Monday,
   * four on Wednesday, the lot by Friday — someone who picked what was
   * there finds more waiting, and none of it is invented: the fixtures
   * are real and the pacing is a decision.
   */
  function reveals(count: number) {
    void run(
      () => setGateReveal(supabase, count),
      (n) =>
        n >= reveal.available
          ? `Showing all ${reveal.available} fixtures.`
          : `Showing the first ${n}.`,
      "Couldn't change that."
    );
  }

  function pickMatch(id: string) {
    void run(
      () => setFeaturedMatch(supabase, id || null),
      () => (id ? "That match is on the gate." : "No match on the gate."),
      "Couldn't set that."
    );
  }

  return (
    <div className="rounded-lg border border-stone-300 bg-stone-0 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium text-stone-900">The gate</h2>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
            initial.is_open
              ? "bg-emerald-800 text-stone-0"
              : "bg-amber-400 text-on-brand"
          }`}
        >
          {initial.is_open ? "App open" : "Counting down"}
        </span>
      </div>

      <p className="mt-1 text-sm text-stone-600">
        While it&apos;s counting down, everyone but staff sees the gate.
        Signing in and predicting the featured match still work.
      </p>

      {notice && (
        <p
          role="status"
          className="mt-3 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-800"
        >
          {notice}
        </p>
      )}

      <label
        htmlFor="gate-opens"
        className="mt-4 block text-sm font-medium text-stone-800"
      >
        Opens at
      </label>
      <input
        id="gate-opens"
        type="datetime-local"
        value={opensAt}
        onChange={(e) => setOpensAt(e.target.value)}
        className={`${input} mt-1`}
      />
      <p className="mt-1 text-xs text-stone-500">
        Leave empty for no gate at all. In your own time zone.
      </p>

      <button
        onClick={saveTime}
        disabled={busy}
        className="mt-2 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-stone-0 disabled:opacity-40"
      >
        {busy ? "Saving…" : "Save time"}
      </button>

      <label
        htmlFor="gate-match"
        className="mt-5 block text-sm font-medium text-stone-800"
      >
        Match on the gate
      </label>
      <select
        id="gate-match"
        value={initial.match_id ?? ""}
        onFocus={loadMatches}
        onChange={(e) => pickMatch(e.target.value)}
        disabled={busy}
        className={`${input} mt-1`}
      >
        <option value="">None</option>

        {/* Until the list loads, the option that's already selected has
            to exist or the control would read "None" for a match that
            is set. */}
        {matches.length === 0 && initial.match_id && (
          <option value={initial.match_id}>
            {initial.home_team ?? "Current match"}
            {initial.away_team ? ` v ${initial.away_team}` : ""}
          </option>
        )}

        {matches.map((m) => (
          <option key={m.id} value={m.id}>
            {m.home_team} v {m.away_team}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-stone-500">
        Name the teams TBD until the schedule lands — the gate says
        &ldquo;teams announced soon&rdquo; and still takes sign-ups.
      </p>

      <div className="mt-5 border-t border-stone-200 pt-4">
        <p className="text-sm font-medium text-stone-800">
          Fixtures on the gate
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-stone-500">
          Everyone sees this many matches to pick, soonest first. Raise
          it through the week so there's something new to come back to.
        </p>

        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => reveals(Math.max(reveal.revealed - 1, 1))}
            disabled={busy || reveal.revealed <= 1}
            aria-label="Show one fewer"
            className="h-10 w-10 rounded-lg border border-stone-300 text-lg font-bold text-stone-700 disabled:opacity-40"
          >
            −
          </button>

          <p className="min-w-[4.5rem] text-center">
            <span className="block text-2xl font-bold tabular-nums leading-none text-stone-900">
              {reveal.revealed}
            </span>
            <span className="block text-xs text-stone-500">
              of {reveal.available}
            </span>
          </p>

          <button
            onClick={() => reveals(reveal.revealed + 1)}
            disabled={busy || reveal.revealed >= reveal.available}
            aria-label="Show one more"
            className="h-10 w-10 rounded-lg border border-stone-300 text-lg font-bold text-stone-700 disabled:opacity-40"
          >
            +
          </button>

          <button
            onClick={() => reveals(4)}
            disabled={busy}
            className="ml-1 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 disabled:opacity-40"
          >
            First 4
          </button>

          <button
            onClick={() => reveals(reveal.available)}
            disabled={busy || reveal.revealed >= reveal.available}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 disabled:opacity-40"
          >
            All
          </button>
        </div>
      </div>

      <div className="mt-5 border-t border-stone-200 pt-4">
        <button
          onClick={toggleForce}
          disabled={busy}
          className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40 ${
            initial.forced
              ? "bg-amber-400 text-on-brand"
              : "border border-stone-300 text-stone-800"
          }`}
        >
          {initial.forced ? "Back on the clock" : "Open it now"}
        </button>
        <p className="mt-1.5 text-xs leading-relaxed text-stone-500">
          Overrides the countdown in both directions. Use it if the clock
          is wrong, or to hold the app shut past the opening time.
        </p>
      </div>
    </div>
  );
}
