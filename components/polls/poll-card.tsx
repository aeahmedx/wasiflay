"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { castVote, PollClosedError, type Poll } from "@/lib/queries/polls";

/**
 * A poll on the home screen.
 *
 * Results appear once you have voted, not before. Showing the running
 * count to someone who hasn't chosen turns a poll into a popularity
 * report and changes what they pick.
 *
 * Signed out, the options are visible but tapping one goes to sign-up.
 * That is the whole reason these exist: a poll you can answer without
 * an account is not a reason to make one.
 */
export function PollCard({
  poll,
  signedIn,
}: {
  poll: Poll;
  signedIn: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Shown immediately on tap; the refresh behind it confirms.
  const [choice, setChoice] = useState<string | null>(
    poll.options.find((o) => o.isMine)?.id ?? null
  );

  const voted = choice !== null || poll.hasVoted;

  async function vote(optionId: string) {
    if (saving) return;

    setSaving(optionId);
    setError(null);

    try {
      await castVote(supabase, poll.id, optionId);
      setChoice(optionId);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof PollClosedError
          ? "That poll has closed."
          : "Couldn't save your vote. Try again."
      );
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="rounded-lg border border-stone-200 bg-stone-0 px-4 py-4">
      <h2 className="font-semibold text-stone-900" dir="auto">
        {poll.question}
      </h2>

      {poll.totalVotes >= 5 && (
        <p className="mt-0.5 text-sm text-stone-500">
          {poll.totalVotes} {poll.totalVotes === 1 ? "vote" : "votes"}
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {poll.options.map((option) => {
          const mine = choice === option.id;

          // Counts only once this person has voted, and only ever as a
          // share of the total so a single vote doesn't read as a
          // landslide.
          const share =
            voted && poll.totalVotes > 0
              ? Math.round((option.votes / poll.totalVotes) * 100)
              : 0;

          if (!signedIn) {
            return (
              <li key={option.id}>
                <Link
                  replace
                  href={`/signup?next=${encodeURIComponent("/")}`}
                  className="block rounded-lg border border-stone-300 px-3.5 py-2.5 text-left text-sm font-medium text-stone-800"
                  dir="auto"
                >
                  {option.label}
                </Link>
              </li>
            );
          }

          return (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => void vote(option.id)}
                disabled={saving !== null}
                aria-pressed={mine}
                className={`relative w-full overflow-hidden rounded-lg border px-3.5 py-2.5 text-left disabled:opacity-60 ${
                  mine
                    ? "border-emerald-800 bg-emerald-50"
                    : "border-stone-300 bg-stone-0"
                }`}
              >
                {/* The bar sits behind the label rather than beside it,
                    so a long name never squeezes the result out. */}
                {voted && (
                  <span
                    aria-hidden
                    className={`absolute inset-y-0 left-0 ${
                      mine ? "bg-emerald-800/15" : "bg-stone-900/5"
                    }`}
                    style={{ width: `${share}%` }}
                  />
                )}

                <span className="relative flex items-center gap-2">
                  <span
                    className="min-w-0 flex-1 text-sm font-medium text-stone-900"
                    dir="auto"
                  >
                    {option.label}
                  </span>

                  {voted && (
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-stone-700">
                      {share}%
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      {!signedIn && (
        <p className="mt-2.5 text-sm text-stone-600">
          Sign in to vote and see the results.
        </p>
      )}

      {signedIn && voted && (
        <p className="mt-2.5 text-sm text-stone-500">
          You can change your vote until it closes.
        </p>
      )}
    </section>
  );
}
