"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signOut();

    /**
     * Pages are cached for offline use, and they're rendered for a
     * specific person — a feed, a profile, a moderation queue. Without
     * clearing them, the next person to use this phone could be served
     * the previous one's screens straight from cache.
     */
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.controller?.postMessage("wl:clear-cache");
    }

    // Browsing preferences are per-person, not per-device. Phones get
    // shared in this community; the next person shouldn't land in
    // someone else's region.
    document.cookie = "wl_region=; path=/; max-age=0";

    router.replace("/signup");
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      disabled={busy}
      className="text-sm text-red-700 underline underline-offset-4 hover:text-red-800 disabled:opacity-50"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
