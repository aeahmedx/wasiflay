"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Catches an expired session.
 *
 * When a refresh token expires, writes start failing with generic errors
 * and nothing explains why — which reads as the app being broken rather
 * than as needing to sign in again. Supabase fires TOKEN_REFRESH_FAILED
 * and SIGNED_OUT for exactly this, so it's caught and said plainly.
 */
export function SessionWatch({ hadSession }: { hadSession: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!hadSession) return;

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" && !session) {
        setExpired(true);
      }
      if (event === "TOKEN_REFRESHED" && session) {
        setExpired(false);
      }
    });

    return () => data.subscription.unsubscribe();
  }, [supabase, hadSession]);

  if (!expired) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 shadow-lg">
      <p className="text-sm text-stone-900">
        You&apos;ve been signed out. Sign in again to post.
      </p>
      <button
        onClick={() => {
          router.replace(
            `/signup?next=${encodeURIComponent(window.location.pathname)}`
          );
          router.refresh();
        }}
        className="mt-2 rounded-lg bg-emerald-800 px-3.5 py-2 text-sm font-medium text-stone-0"
      >
        Sign in
      </button>
    </div>
  );
}
