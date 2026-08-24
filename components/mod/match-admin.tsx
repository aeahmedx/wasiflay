"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  cancelMatch,
  createMatch,
  getStaffMatches,
  kickoffLabel,
  lockMatch,
  ROUND_LABEL,
  setResult,
  type MatchRound,
  type StaffMatch,
} from "@/lib/queries/predictions";

const ROUNDS: MatchRound[] = ["group", "quarter", "semi", "final"];

const input =
  "w-full rounded-lg border border-stone-300 bg-stone-0 px-3 py-2.5 text-stone-900";

/**
 * Match management, designed to be used standing at the side of a pitch
 * on a phone.
 *
 * The two actions that matter during a tournament are Lock and the
 * result, so both are one tap and a number — everything else is folded
 * away. A result entered five minutes late is a moment lost: people are
 * standing there when the whistle goes, and the leaderboard should move
 * while they're still looking at it.
 */
export function MatchAdmin() {
  const supabase = useMemo(() => createClient(), []);

  const [matches, setMatches] = useState<StaffMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [kickoff, setKickoff] = useState("");
  const [round, setRound] = useState<MatchRound>("group");

  // Result entry, per match
  const [scoring, setScoring] = useState<string | null>(null);
  const [hs, setHs] = useState("");
  const [as_, setAs] = useState("");

  const load = useCallback(async () => {
    try {
      setMatches(await getStaffMatches(supabase));
    } catch (e) {
      setNotice(
        `Couldn't load: ${e instanceof Error ? e.message : "unknown error"}`
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!home.trim() || !away.trim() || !kickoff) return;
    setBusy("add");
    setNotice(null);
    try {
      await createMatch(
        supabase,
        home.trim(),
        away.trim(),
        new Date(kickoff).toISOString(),
        round
      );
      setHome("");
      setAway("");
      setKickoff("");
      setAdding(false);
      await load();
    } catch {
      setNotice("Couldn't add that match.");
    } finally {
      setBusy(null);
    }
  }

  async function lock(id: string) {
    setBusy(id);
    try {
      await lockMatch(supabase, id);
      await load();
    } catch {
      setNotice("Couldn't lock it.");
    } finally {
      setBusy(null);
    }
  }

  async function saveResult(id: string) {
    const h = Number(hs);
    const a = Number(as_);
    if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0) {
      setNotice("Scores need to be whole numbers.");
      return;
    }
    setBusy(id);
    setNotice(null);
    try {
      const scored = await setResult(supabase, id, h, a);
      setScoring(null);
      setHs("");
      setAs("");
      await load();
      setNotice(
        scored === 1 ? "1 prediction scored." : `${scored} predictions scored.`
      );
    } catch {
      setNotice("Couldn't save the result.");
    } finally {
      setBusy(null);
    }
  }

  async function cancel(id: string) {
    setBusy(id);
    try {
      await cancelMatch(supabase, id);
      await load();
    } catch {
      setNotice("Couldn't cancel it.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs leading-relaxed text-stone-500">
          Lock a match when the ball actually moves, not when the schedule
          said. Enter the result the moment it ends.
        </p>
        <button
          onClick={() => setAdding((v) => !v)}
          className="shrink-0 rounded-full bg-emerald-800 px-3.5 py-1.5 text-sm font-medium text-stone-0"
        >
          {adding ? "Close" : "Add match"}
        </button>
      </div>

      {notice && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm text-stone-800"
        >
          {notice}
        </div>
      )}

      {adding && (
        <div className="mb-4 space-y-3 rounded-lg border border-stone-300 bg-stone-0 px-4 py-4">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={home}
              onChange={(e) => setHome(e.target.value)}
              placeholder="Home team"
              dir="auto"
              className={input}
            />
            <input
              value={away}
              onChange={(e) => setAway(e.target.value)}
              placeholder="Away team"
              dir="auto"
              className={input}
            />
          </div>
          <input
            type="datetime-local"
            value={kickoff}
            onChange={(e) => setKickoff(e.target.value)}
            className={input}
          />
          <select
            value={round}
            onChange={(e) => setRound(e.target.value as MatchRound)}
            className={input}
          >
            {ROUNDS.map((r) => (
              <option key={r} value={r}>
                {ROUND_LABEL[r]}
              </option>
            ))}
          </select>
          <button
            onClick={add}
            disabled={busy === "add" || !home.trim() || !away.trim() || !kickoff}
            className="w-full rounded-lg bg-emerald-800 px-4 py-2.5 font-medium text-stone-0 disabled:opacity-40"
          >
            {busy === "add" ? "Adding…" : "Add"}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-stone-500">Loading…</p>
      ) : matches.length === 0 ? (
        <p className="rounded-lg border border-stone-200 bg-stone-0 px-4 py-8 text-center text-stone-600">
          No matches yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {matches.map((m) => (
            <li
              key={m.id}
              className="rounded-lg border border-stone-200 bg-stone-0 px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-stone-900" dir="auto">
                    {m.home_team} v {m.away_team}
                  </p>
                  <p className="mt-0.5 text-sm text-stone-600">
                    {kickoffLabel(m.kicks_off_at)} · {ROUND_LABEL[m.round]} ·{" "}
                    {m.prediction_count}{" "}
                    {m.prediction_count === 1 ? "pick" : "picks"}
                  </p>
                </div>

                {m.status === "finished" && (
                  <span className="shrink-0 rounded bg-emerald-50 px-2 py-0.5 text-sm font-medium text-emerald-900">
                    {m.home_score}–{m.away_score}
                  </span>
                )}
                {m.status === "locked" && (
                  <span className="shrink-0 rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                    Locked
                  </span>
                )}
              </div>

              {scoring === m.id ? (
                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={20}
                      value={hs}
                      onChange={(e) => setHs(e.target.value)}
                      aria-label={`${m.home_team} score`}
                      className="w-16 rounded-lg border border-stone-300 bg-stone-0 px-3 py-2.5 text-center text-lg text-stone-900"
                    />
                    <span className="text-stone-500">–</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={20}
                      value={as_}
                      onChange={(e) => setAs(e.target.value)}
                      aria-label={`${m.away_team} score`}
                      className="w-16 rounded-lg border border-stone-300 bg-stone-0 px-3 py-2.5 text-center text-lg text-stone-900"
                    />
                    <button
                      onClick={() => saveResult(m.id)}
                      disabled={busy === m.id}
                      className="ml-auto rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-medium text-stone-0 disabled:opacity-40"
                    >
                      {busy === m.id ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={() => setScoring(null)}
                      className="rounded-lg border border-stone-300 px-3 py-2.5 text-sm text-stone-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {m.status === "scheduled" && (
                    <button
                      onClick={() => lock(m.id)}
                      disabled={busy === m.id}
                      className="rounded-lg border border-stone-300 px-3.5 py-2 text-sm font-medium text-stone-800 disabled:opacity-40"
                    >
                      {busy === m.id ? "…" : "Lock picks"}
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setScoring(m.id);
                      setHs(m.home_score?.toString() ?? "");
                      setAs(m.away_score?.toString() ?? "");
                    }}
                    className="rounded-lg bg-emerald-800 px-3.5 py-2 text-sm font-medium text-stone-0"
                  >
                    {m.status === "finished" ? "Fix result" : "Enter result"}
                  </button>

                  {m.prediction_count === 0 && (
                    <button
                      onClick={() => cancel(m.id)}
                      disabled={busy === m.id}
                      className="rounded-lg border border-red-300 px-3.5 py-2 text-sm text-red-800 disabled:opacity-40"
                    >
                      Cancel match
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
