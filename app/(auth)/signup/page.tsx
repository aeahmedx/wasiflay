"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/safe-next";
import { Wordmark } from "@/components/wordmark";

const ERRORS: Record<string, string> = {
  missing_code: "Sign-in didn't complete. Try again.",
  exchange_failed: "Sign-in didn't complete. Try again.",
};

/**
 * The three steps, shown before the button rather than after it.
 *
 * Signing in is the only thing anyone can do on this page, and it costs
 * them something — an account, on a domain they may not know. Showing
 * what it's the first step of makes it a step rather than a toll. The
 * two below it are the reward, and they're specific: nobody is moved by
 * "join the community".
 */
const STEPS = [
  { n: 1, label: "Sign in", note: "Ten seconds with Google" },
  {
    n: 2,
    label: "Call the scores",
    note: "Change them any time before kickoff",
  },
  { n: 3, label: "Talk your talk", note: "Live rooms while it's playing" },
];

export default function SignupPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Surfaces the error left in the URL by a failed callback.
   *
   * Deferred by a tick rather than set straight from the effect body:
   * an update during mount costs a render pass before paint, and this
   * message only matters on the rare load that follows a failed
   * sign-in.
   *
   * Deliberately not useSearchParams() — that hook opts the route out
   * of static rendering and fails the production build unless it sits
   * under a Suspense boundary.
   */
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (!code || !ERRORS[code]) return;

    const timer = setTimeout(() => setError(ERRORS[code]), 0);
    return () => clearTimeout(timer);
  }, []);

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Read here rather than held in state: it is only ever the
        // destination, never something rendered.
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          safeNext(new URLSearchParams(window.location.search).get("next"))
        )}`,
      },
    });

    if (error) {
      setError("Couldn't reach Google. Check your connection and try again.");
      setLoading(false);
    }
    // On success the browser navigates away; no need to unset loading.
  }

  return (
    <main className="min-h-dvh bg-stone-50 px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="flex justify-center">
          <Wordmark size="sm" priority />
        </div>

        <p className="mt-4 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">
          2026 Tournament Experience
        </p>

        <h1 className="mt-2 text-center text-2xl font-bold leading-tight tracking-tight text-stone-900">
          Call every score.
        </h1>

        {/* The steps sit above the button: what you're starting, before
            what it costs. */}
        <ol className="mt-7 space-y-3">
          {STEPS.map((step) => (
            <li key={step.n} className="flex items-center gap-3">
              <span
                aria-hidden
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  step.n === 1
                    ? "bg-amber-400 text-on-brand"
                    : "bg-stone-200 text-stone-500"
                }`}
              >
                {step.n}
              </span>
              <span className="min-w-0">
                <span
                  className={`block text-sm font-semibold ${
                    step.n === 1 ? "text-stone-900" : "text-stone-600"
                  }`}
                >
                  {step.label}
                </span>
                <span className="block text-xs text-stone-500">
                  {step.note}
                </span>
              </span>
            </li>
          ))}
        </ol>

        {error && (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        <button
          onClick={signInWithGoogle}
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg border border-stone-300 bg-stone-0 px-4 py-3.5 font-medium text-stone-900 transition hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 disabled:opacity-60"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
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
          threads are removed. This applies to everyone equally. By
          continuing you agree to the{" "}
          <Link href="/terms" className="underline underline-offset-2">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
