"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { deleteOwnContent } from "@/lib/queries/own-content";
import { deleteStoredImage } from "@/lib/queries/images";

/**
 * Deletes something you wrote. Soft on the server, so answers under a
 * deleted post survive — but it's gone from every surface.
 *
 * Grey until hovered, red on reach, with a yes/no step. Same shape as
 * the admin control so the two read as one family.
 */
export function DeleteOwnButton({
  targetType,
  targetId,
  imageUrl,
  label = "Delete",
  redirectTo,
}: {
  targetType: "post" | "answer" | "message";
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
      if (imageUrl) await deleteStoredImage(supabase, imageUrl);
      await deleteOwnContent(supabase, targetType, targetId);
      if (redirectTo) router.replace(redirectTo);
      router.refresh();
    } catch {
      setError("Couldn't delete.");
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
      <span className="text-stone-700">Delete?</span>
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
