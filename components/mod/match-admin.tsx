"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  cancelMatch,
  createMatch,
  deleteMatch,
  getDeleteImpact,
  getStaffMatches,
  kickoffLabel,
  lockMatch,
  ROUND_LABEL,
  setResult,
  type DeleteImpact,
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
export function MatchAdmin({ isAdmin = false }: { isAdmin?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [matches, setMatches] = useState<StaffMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [kickoff, setKickoff] = useState("");
  const [round, setRound] = useState<MatchRound>("group");

  // Delete confirmation, per match
  const [deleting, setDeleting] = useState<string | null>(null);
  const [impact, setImpact] = useState<DeleteImpact | null>(null);
  const [typed, setTyped] = useState("");

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
      // Without this, tapping back lands on a cached home page that
      // doesn't know the match exists.
      router.refresh();
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
      router.refresh();
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
      router.refresh();
      setNotice(
        scored === 1 ? "1 prediction scored." : `${scored} predictions scored.`
      );
    } catch {
      setNotice("Couldn't save the result.");
    } finally {
      setBusy(null);
    }
  }

  async function startDelete(id: string) {
    setDeleting(id);
    setTyped("");
    setImpact(null);
    // Ask what it would cost before offering to do it.
    setImpact(await getDeleteImpact(supabase, id));
  }

  async function confirmDelete(id: string) {
    setBusy(id);
    setNotice(null);
    try {
      await deleteMatch(supabase, id);
      setDeleting(null);
      setImpact(null);
      setTyped("");
      await load();
      router.refresh();
      setNotice("Match deleted.");
    } catch (e) {
      const raw = e instanceof Error ? e.message : "";
      setNotice(
        raw.includes("ADMIN_ONLY")
          ? "Only an admin can delete a match."
          : "Couldn't delete it."
      );
    } finally {
      setBusy(null);
    }
  }

  async function cancel(id: string) {
    setBusy(id);
    try {
      await cancelMatch(supabase, id);
      await load();
      router.refresh();
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

              {deleting === m.id ? (
                <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-3">
                  <p className="text-sm font-medium text-stone-900">
                    Delete {m.home_team} v {m.away_team}?
                  </p>

                  {impact === null ? (
                    <p className="mt-1 text-sm text-stone-600">Checking…</p>
                  ) : impact.prediction_count === 0 ? (
                    <p className="mt-1 text-sm text-stone-700">
                      Nobody predicted this one, so nothing else is affected.
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-stone-700">
                      This removes {impact.prediction_count}{" "}
                      {impact.prediction_count === 1 ? "prediction" : "predictions"}{" "}
                      from {impact.people_affected}{" "}
                      {impact.people_affected === 1 ? "person" : "people"}
                      {impact.points_awarded > 0 && (
                        <> and takes back {impact.points_awarded} points</>
                      )}
                      . Their leaderboard positions will change. Cancelling
                      hides the match instead and keeps all of that.
                    </p>
                  )}

                  {impact !== null && impact.has_room && (
                    <p className="mt-1 text-sm text-stone-600">
                      The room stays — only the link to it goes.
                    </p>
                  )}

                  {impact !== null && impact.prediction_count > 0 && (
                    <>
                      <label
                        htmlFor={`del-${m.id}`}
                        className="mt-2 block text-sm text-stone-800"
                      >
                        Type DELETE to confirm
                      </label>
                      <input
                        id={`del-${m.id}`}
                        value={typed}
                        onChange={(e) => setTyped(e.target.value)}
                        autoComplete="off"
                        className="mt-1 w-full rounded-lg border border-stone-300 bg-stone-0 px-3 py-2 text-stone-900"
                      />
                    </>
                  )}

                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button
                      onClick={() => confirmDelete(m.id)}
                      disabled={
                        busy === m.id ||
                        impact === null ||
                        (impact.prediction_count > 0 && typed !== "DELETE")
                      }
                      className="rounded-lg bg-red-800 px-3.5 py-2 text-sm font-medium text-stone-0 disabled:opacity-40"
                    >
                      {busy === m.id ? "Deleting…" : "Delete for good"}
                    </button>
                    <button
                      onClick={() => cancel(m.id)}
                      disabled={busy === m.id}
                      className="rounded-lg border border-stone-300 bg-stone-0 px-3.5 py-2 text-sm text-stone-800 disabled:opacity-40"
                    >
                      Just hide it
                    </button>
                    <button
                      onClick={() => setDeleting(null)}
                      className="rounded-lg border border-stone-300 bg-stone-0 px-3.5 py-2 text-sm text-stone-700"
                    >
                      Keep it
                    </button>
                  </div>
                </div>
              ) : scoring === m.id ? (
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

                  {isAdmin ? (
                    <button
                      onClick={() => startDelete(m.id)}
                      disabled={busy === m.id}
                      className="rounded-lg border border-red-300 px-3.5 py-2 text-sm text-red-800 disabled:opacity-40"
                    >
                      Delete
                    </button>
                  ) : (
                    m.prediction_count === 0 && (
                      <button
                        onClick={() => cancel(m.id)}
                        disabled={busy === m.id}
                        className="rounded-lg border border-red-300 px-3.5 py-2 text-sm text-red-800 disabled:opacity-40"
                      >
                        Hide match
                      </button>
                    )
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
