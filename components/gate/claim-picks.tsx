"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  clearPendingPicks,
  readPendingPicks,
} from "@/lib/pending-picks";

/**
 * Writes the picks somebody made before they had an account.
 *
 * Runs once, on the gate, after sign-in. Reads the cookie, saves each
 * pick, clears the cookie, refreshes.
 *
 * Every failure here is silent on purpose. If a pick doesn't save, the
 * person is signed in looking at a page where they can pick again —
 * which is exactly where the old flow left them. An error message would
 * make a worse first impression than a missing pick.
 */
export function ClaimPicks({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!signedIn || done) return;

    const pending = readPendingPicks();
    if (pending.length === 0) return;

    let cancelled = false;

    // Deferred so this never updates state during mount.
    const timer = setTimeout(async () => {
      for (const pick of pending) {
        try {
          await supabase.rpc("make_prediction", {
            p_match: pick.matchId,
            p_home: pick.home,
            p_away: pick.away,
          });
        } catch {
          // A match that locked while they were signing in, most
          // likely. Skip it and keep the rest.
        }
      }

      clearPendingPicks();
      if (!cancelled) {
        setDone(true);
        router.refresh();
      }
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [signedIn, done, supabase, router]);

  return null;
}
