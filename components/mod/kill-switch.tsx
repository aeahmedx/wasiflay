"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setReadOnly } from "@/lib/queries/safety";

const DEFAULT_NOTICE =
  "Wasif Lay is read-only for a moment. You can still read everything.";

/**
 * Freezes all writes across the platform — posts, answers, messages,
 * reactions, reports — in one action. Admins stay able to moderate.
 *
 * The case this exists for: something goes badly wrong on a Saturday
 * afternoon with thousands of people on the site and shipping a code
 * change from a parking lot isn't an option.
 */
export function KillSwitch({
  initialReadOnly,
  initialNotice,
}: {
  initialReadOnly: boolean;
  initialNotice: string | null;
}) {
  const router = useRouter();
  const [on, setOn] = useState(initialReadOnly);
  const [notice, setNotice] = useState(initialNotice ?? DEFAULT_NOTICE);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      await setReadOnly(createClient(), next, next ? notice.trim() : null);
      setOn(next);
      setConfirming(false);
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        msg.includes("ADMIN_ONLY")
          ? "Admins only."
          : "That didn't go through. Try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-stone-300 bg-stone-0 px-4 py-4">
      <h2 className="font-medium text-stone-900">Read-only mode</h2>
      <p className="mt-1 text-sm text-stone-600">
        Stops everyone posting, answering, messaging, and reacting. Reading
        keeps working. Admins can still moderate.
      </p>

      {on ? (
        <>
          <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-stone-900">
            The site is currently read-only.
          </p>
          <button
            onClick={() => apply(false)}
            disabled={busy}
            className="mt-3 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-stone-0 disabled:opacity-40"
          >
            {busy ? "Working…" : "Turn writing back on"}
          </button>
        </>
      ) : confirming ? (
        <>
          <label
            htmlFor="ro-notice"
            className="mt-3 block text-sm font-medium text-stone-800"
          >
            What people will see
          </label>
          <textarea
            id="ro-notice"
            value={notice}
            onChange={(e) => setNotice(e.target.value)}
            rows={2}
            maxLength={200}
            className="mt-1 w-full resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900"
          />
          <div className="mt-2.5 flex gap-2">
            <button
              onClick={() => apply(true)}
              disabled={busy}
              className="rounded-lg bg-red-800 px-3.5 py-2 text-sm font-medium text-stone-0 disabled:opacity-40"
            >
              {busy ? "Freezing…" : "Freeze the site"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-stone-300 px-3.5 py-2 text-sm text-stone-700"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="mt-3 rounded-lg border border-red-300 px-3.5 py-2 text-sm text-red-800"
        >
          Freeze the site
        </button>
      )}

      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
