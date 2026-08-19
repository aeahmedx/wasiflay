"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { adminHardDelete, type ReportTarget } from "@/lib/queries/moderation";
import { deleteStoredImage } from "@/lib/queries/images";

/**
 * Permanent deletion, admin only. Rendered compact so it sits beside
 * Edit without shouting — grey until you reach for it, red on hover, and
 * a yes/no step before anything happens.
 */
export function AdminDeleteButton({
  targetType,
  targetId,
  imageUrl,
  label = "Delete",
  redirectTo,
}: {
  targetType: ReportTarget;
  targetId: string;
  imageUrl?: string | null;
  label?: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      // File before row: the other order can orphan an image that stays
      // reachable by URL with nothing left pointing at it.
      if (imageUrl) await deleteStoredImage(supabase, imageUrl);
      await adminHardDelete(supabase, targetType, targetId);
      if (redirectTo) router.replace(redirectTo);
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        msg.includes("ADMIN_ONLY") ? "Admins only." : "Couldn't delete."
      );
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
        {label}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className="text-stone-700">Delete forever?</span>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="text-red-700 underline underline-offset-4 disabled:opacity-40"
      >
        {busy ? "…" : "Yes"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-stone-600 underline underline-offset-4"
      >
        No
      </button>
      {error && <span className="text-red-700">{error}</span>}
    </span>
  );
}
