"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { TERMS_VERSION } from "@/lib/legal";
import { Toggle } from "@/components/ui/toggle";

/**
 * Blocks the app until the current terms are accepted.
 *
 * An overlay rather than a redirect, so a deep link from WhatsApp still
 * lands on the right page once they accept — a redirect would drop them
 * on the home feed and lose whatever they came for.
 *
 * Only signed-in accounts see this. Reading without an account stays
 * open; there's nothing to agree to if you aren't posting.
 */
export function TermsGate({
  userId,
  isMinor,
}: {
  userId: string;
  isMinor: boolean;
}) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    if (!agreed || saving) return;
    setSaving(true);
    setError(null);

    const failed = () => {
      setError("Couldn't save that. Check your connection and try again.");
      setSaving(false);
    };

    try {
      // Supabase returns failures in `error` rather than throwing, so
      // this is checked, not caught. The try/catch is only here for a
      // network-level rejection.
      const { error: writeError } = await createClient()
        .from("profiles")
        .update({
          terms_accepted_at: new Date().toISOString(),
          terms_version: TERMS_VERSION,
        })
        .eq("id", userId);

      if (writeError) {
        failed();
        return;
      }

      router.refresh();
    } catch {
      failed();
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-gate-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 p-3 sm:items-center"
    >
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-lg border border-stone-300 bg-stone-0 px-5 py-5">
        <h2
          id="terms-gate-title"
          className="text-lg font-semibold text-stone-900"
        >
          Before you start
        </h2>

        <p className="mt-2 text-stone-700 leading-relaxed">
          Wasif Lay is a community space. A few things worth knowing:
        </p>

        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-stone-700 leading-relaxed">
          <li>Be kind. Attacks on people get removed.</li>
          <li>
            This is for coordination, not political argument.
          </li>
          <li>
            Nobody here is verified — check credentials yourself before
            trusting or hiring someone.
          </li>
          <li>
            Don&apos;t post other people&apos;s private details.
          </li>
        </ul>

        <p className="mt-3 text-sm text-stone-600 leading-relaxed">
          Read the{" "}
          <Link
            href="/terms"
            className="text-emerald-800 underline underline-offset-4"
          >
            Terms of Use
          </Link>
          ,{" "}
          <Link
            href="/privacy"
            className="text-emerald-800 underline underline-offset-4"
          >
            Privacy
          </Link>
          , and{" "}
          <Link
            href="/guidelines"
            className="text-emerald-800 underline underline-offset-4"
          >
            Community Guidelines
          </Link>
          .
        </p>

        {isMinor && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-stone-800">
            You&apos;re under 18, so a parent or guardian needs to read
            these with you and agree before you continue.
          </p>
        )}

        <div className="mt-4">
          <Toggle
            checked={agreed}
            onChangeAction={setAgreed}
            label={
              isMinor
                ? "My parent or guardian and I agree"
                : "I agree to the Terms, Privacy, and Guidelines"
            }
          />
        </div>

        {error && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          onClick={accept}
          disabled={!agreed || saving}
          className="mt-4 w-full rounded-lg bg-emerald-800 px-4 py-3 font-medium text-stone-0 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
