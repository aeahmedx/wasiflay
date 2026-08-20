"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { blockUser } from "@/lib/queries/safety";

/**
 * Blocking is mutual in effect — they disappear from your view and you
 * disappear from theirs. Deliberately quiet: no confirmation to the
 * other person, no notification, nothing that turns leaving a
 * conversation into a confrontation.
 */
export function BlockButton({
  viewerId,
  targetId,
  targetName,
}: {
  viewerId: string;
  targetId: string;
  targetName: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await blockUser(createClient(), viewerId, targetId);
      router.replace("/");
      router.refresh();
    } catch {
      setError("Couldn't block. Try again.");
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm text-stone-500 underline underline-offset-4 transition-colors hover:text-red-700"
      >
        Block
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-stone-300 bg-stone-0 p-3 text-left">
      <p className="text-sm text-stone-800">
        Block {targetName}? You won&apos;t see each other&apos;s posts,
        answers, or messages. They aren&apos;t told.
      </p>
      {error && <p className="mt-1.5 text-sm text-red-700">{error}</p>}
      <div className="mt-2.5 flex gap-2">
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="rounded-lg bg-stone-900 px-3.5 py-2 text-sm font-medium text-stone-0 disabled:opacity-40"
        >
          {busy ? "Blocking…" : "Block"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-lg border border-stone-300 px-3.5 py-2 text-sm text-stone-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
