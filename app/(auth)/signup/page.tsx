"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/safe-next";

const ERRORS: Record<string, string> = {
  missing_code: "Sign-in didn't complete. Try again.",
  exchange_failed: "Sign-in didn't complete. Try again.",
};

export default function SignupPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Where to land after sign-in. Set from ?next= so someone who hits the
  // sign-in prompt inside a room returns to that room, not to Home.
  const [next, setNext] = useState("/");

  // Read the callback error and return path from the URL directly.
  // Deliberately NOT useSearchParams() — that hook opts the route out of
  // prerendering and fails the production build unless wrapped in Suspense.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("error");
    if (code && ERRORS[code]) setError(ERRORS[code]);
    setNext(safeNext(params.get("next")));
  }, []);

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setError("Couldn't reach Google. Check your connection and try again.");
      setLoading(false);
    }
    // On success the browser navigates away; no need to unset loading.
  }

  return (
    <main className="min-h-dvh flex flex-col justify-center px-6 py-12 bg-stone-50">
      <div className="w-full max-w-sm mx-auto">
        <div className="mb-10">
          <div
            aria-hidden
            className="w-11 h-11 rounded-lg bg-emerald-800 flex items-center justify-center mb-6"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
              <path
                d="M5 12h12m0 0-4-4m4 4-4 4"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
            Wasif Lay
          </h1>
          <p className="mt-2 text-stone-600 leading-relaxed">
            Find the right person, the right answer, the right next step.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        <button
          onClick={signInWithGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 rounded-lg border border-stone-300 bg-stone-0 px-4 py-3.5 font-medium text-stone-900 transition hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 disabled:opacity-60"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.05l3.66 2.84c.87-2.6 3.3-4.51 6.16-4.51Z"
            />
          </svg>
          {loading ? "Opening Google…" : "Continue with Google"}
        </button>

        <p className="mt-6 text-xs leading-relaxed text-stone-500">
          Wasif Lay is for coordination, not conflict. Political argument
          threads are removed. This applies to everyone equally.
        </p>
      </div>
    </main>
  );
}
