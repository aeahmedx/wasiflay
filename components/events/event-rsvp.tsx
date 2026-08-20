"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  cancelRsvp,
  eventErrorMessage,
  rsvp,
  type WasifEvent,
} from "@/lib/queries/events";

/**
 * Two different things wearing similar clothes:
 *
 *   Interested — a headcount. No details leave your account.
 *   Attending  — online events only, and it hands your name, phone and
 *                email to the organiser. So it asks, plainly, first.
 *
 * Under 18, the second one still works and the organiser still gets a
 * headcount — but no details are released. That's enforced in the
 * database, not here.
 */
export function EventRsvp({
  event,
  signedIn,
  isMinor,
}: {
  event: WasifEvent;
  signedIn: boolean;
  isMinor: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (!signedIn) {
    return (
      <Link
        href={`/signup?next=${encodeURIComponent(`/events/${event.id}`)}`}
        className="block rounded-lg bg-emerald-800 px-4 py-3 text-center font-medium text-stone-0"
      >
        Sign in to sign up
      </Link>
    );
  }

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setConfirming(false);
      router.refresh();
    } catch (e) {
      setError(eventErrorMessage(e instanceof Error ? e.message : ""));
    } finally {
      setBusy(false);
    }
  }

  const supabase = createClient();
  const online = event.kind === "online";

  if (event.my_rsvp) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
        <p className="text-sm text-emerald-900">
          {event.my_rsvp === "attending"
            ? "You're signed up. The joining link is below."
            : "You're marked as interested."}
        </p>
        <button
          onClick={() => act(() => cancelRsvp(supabase, event.id))}
          disabled={busy}
          className="mt-2 text-sm text-stone-600 underline underline-offset-4 disabled:opacity-40"
        >
          {busy ? "…" : event.my_rsvp === "attending" ? "Cancel and remove my details" : "Not going after all"}
        </button>
        {error && <p className="mt-1.5 text-sm text-red-700">{error}</p>}
      </div>
    );
  }

  if (online && confirming) {
    return (
      <div className="rounded-lg border border-stone-300 bg-stone-0 px-4 py-4">
        <p className="font-medium text-stone-900">Before you sign up</p>
        <p className="mt-1.5 text-sm text-stone-700 leading-relaxed">
          {isMinor ? (
            <>
              You&apos;re under 18, so the organiser will see that someone
              is attending but <strong>none of your details</strong> are
              shared.
            </>
          ) : (
            <>
              Your <strong>name, phone and email</strong> are shared with
              the organiser so they can send you joining details. Nobody
              else sees them, and they&apos;re deleted 30 days after the
              event.
            </>
          )}
        </p>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => act(() => rsvp(supabase, event.id, "attending", true))}
            disabled={busy}
            className="rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-medium text-stone-0 disabled:opacity-40"
          >
            {busy ? "Signing up…" : "I agree, sign me up"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm text-stone-700"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        {online && (
          <button
            onClick={() => setConfirming(true)}
            className="flex-1 rounded-lg bg-emerald-800 px-4 py-3 font-medium text-stone-0"
          >
            Sign up
          </button>
        )}
        <button
          onClick={() => act(() => rsvp(supabase, event.id, "interested"))}
          disabled={busy}
          className={`rounded-lg border border-stone-300 px-4 py-3 font-medium text-stone-700 disabled:opacity-40 ${
            online ? "" : "w-full"
          }`}
        >
          {busy ? "…" : "Interested"}
        </button>
      </div>
      {!online && (
        <p className="mt-1.5 text-xs text-stone-500">
          Nothing is shared with anyone — it&apos;s just a headcount.
        </p>
      )}
      {error && <p className="mt-1.5 text-sm text-red-700">{error}</p>}
    </div>
  );
}
