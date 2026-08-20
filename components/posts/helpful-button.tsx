"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addVote, removeVote, type VoteTarget } from "@/lib/queries/posts";
import { announceIfOffline } from "@/lib/offline";

/**
 * SPEC 5.2 — helpful votes are optimistic toggles. The displayed count is
 * local state seeded from the server value; the DB trigger owns the real
 * number and it reconciles on the next page load.
 */
export function HelpfulButton({
  target,
  targetId,
  initialCount,
  initiallyVoted,
  canVote,
}: {
  target: VoteTarget;
  targetId: string;
  initialCount: number;
  initiallyVoted: boolean;
  canVote: boolean;
}) {
  const [voted, setVoted] = useState(initiallyVoted);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!canVote || busy) return;

    // Offline the write fails and the count rolls back — the number
    // flips and unflips, which looks like a glitch rather than a
    // missing connection.
    if (announceIfOffline()) return;

    const nextVoted = !voted;
    setVoted(nextVoted);
    setCount((c) => c + (nextVoted ? 1 : -1));
    setBusy(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("no session");

      if (nextVoted) {
        await addVote(supabase, user.id, target, targetId);
      } else {
        await removeVote(supabase, user.id, target, targetId);
      }
    } catch {
      // Roll back rather than showing a wrong count.
      setVoted(!nextVoted);
      setCount((c) => c + (nextVoted ? -1 : 1));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={!canVote || busy}
      aria-pressed={voted}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition ${
        voted
          ? "border-emerald-800 bg-emerald-50 text-emerald-900"
          : "border-stone-300 text-stone-600 hover:border-stone-400"
      } ${!canVote ? "opacity-50" : ""}`}
    >
      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" aria-hidden>
        <path
          d="M3 7.5h2v6H3zM6 13.5V7l3-5c.9 0 1.5.7 1.5 1.5V6h2.2c.9 0 1.6.8 1.4 1.7l-.9 4.5c-.1.7-.8 1.3-1.5 1.3H6z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      Helpful{count > 0 ? ` · ${count}` : ""}
    </button>
  );
}
