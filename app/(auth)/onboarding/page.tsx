"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createProfile } from "@/lib/queries/profiles";
import { safeNext } from "@/lib/safe-next";
import { MINIMUM_AGE } from "@/lib/legal";
import { readPromoCode } from "@/lib/promo-code";

function yearsSince(dob: string): number {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return NaN;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

/**
 * Google hands back a name in one of several shapes depending on how the
 * account was set up. Take the first that exists rather than assuming.
 */
function nameFromGoogle(meta: Record<string, unknown> | undefined): string {
  if (!meta) return "";
  for (const key of ["full_name", "name", "preferred_username"]) {
    const value = meta[key];
    if (typeof value === "string" && value.trim().length >= 2) {
      return value.trim().slice(0, 50);
    }
  }
  return "";
}

/**
 * The last screen before the app.
 *
 * It used to ask for four things: name, region, town and date of birth.
 * Three of those Google already knows or the app can default, and every
 * one of them was a place to abandon a sign-up that had already been
 * agreed to.
 *
 * What's left is the date of birth, which stays because the whole minor
 * protection layer depends on it — RSVP rules, contact details never
 * released, what a moderator sees. That isn't friction, it's the thing
 * that lets under-18s use this at all.
 *
 * The name is prefilled from Google and editable. Region and country
 * are dropped: region filtering is switched off for launch, and the
 * flag has a sensible default. Both can be set later from profile edit.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [checking, setChecking] = useState(true);
  const [dob, setDob] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/signup");
        return;
      }

      setUserId(data.user.id);
      setDisplayName(
        nameFromGoogle(data.user.user_metadata) ||
          // An account with no name attached still needs something; the
          // field is editable and the button stays disabled until it is
          // long enough.
          ""
      );
      setChecking(false);
    });
  }, [router]);

  const age = dob ? yearsSince(dob) : NaN;
  const tooYoung = !Number.isNaN(age) && age < MINIMUM_AGE;

  const valid =
    displayName.trim().length >= 2 &&
    displayName.trim().length <= 50 &&
    !Number.isNaN(age) &&
    age >= MINIMUM_AGE &&
    age < 120;

  async function submit() {
    if (!userId || !valid) return;
    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      await createProfile(supabase, {
        id: userId,
        display_name: displayName.trim(),
        // Nullable, and region filtering is off for launch. Someone can
        // set it from profile edit whenever it starts to matter.
        region: null,
        city: null,
        date_of_birth: dob,
        // Column default, stated here so the shape stays explicit.
        country_flag: "SD",
        /**
         * Which printed card brought them, if any. Read at the point of
         * use rather than held in state — it is written once and can
         * never go stale that way.
         */
        promo_code: readPromoCode(),
      });

      router.replace(
        safeNext(new URLSearchParams(window.location.search).get("next"))
      );
      router.refresh();
    } catch (e) {
      /**
       * Supabase errors keep their detail on non-enumerable fields, so
       * logging the object alone prints "{}". Pulled out by hand so a
       * failure here is diagnosable without another round trip.
       */
      const err = e as { message?: string; code?: string; details?: string };
      console.error(
        "createProfile failed:",
        [err.code, err.message, err.details].filter(Boolean).join(" · ") || e
      );

      setError(
        (err.message ?? "").includes("duplicate")
          ? "You already have a profile. Reloading."
          : "Couldn't save your profile. Check your connection and try again."
      );
      setSaving(false);
    }
  }

  if (checking) {
    return (
      <main className="min-h-dvh grid place-items-center bg-stone-50">
        <p className="text-stone-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex flex-col justify-center px-6 py-12 bg-stone-50">
      <div className="w-full max-w-sm mx-auto">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          One last thing
        </h1>
        <p className="mt-2 mb-8 text-stone-600">
          Then you&apos;re in.
        </p>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        <div className="space-y-5">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-stone-800 mb-1.5"
            >
              Name
            </label>
            <input
              id="name"
              dir="auto"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
              className="w-full rounded-lg border border-stone-300 bg-stone-0 px-3.5 py-3 text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-800"
            />
            <p className="mt-1.5 text-xs text-stone-500">
              How the community sees you. Change it any time.
            </p>
          </div>

          <div>
            <label
              htmlFor="dob"
              className="block text-sm font-medium text-stone-800 mb-1.5"
            >
              Date of birth
            </label>
            <input
              id="dob"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="w-full rounded-lg border border-stone-300 bg-stone-0 px-3.5 py-3 text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-800"
            />
            {tooYoung ? (
              <p className="mt-2 text-sm text-red-700">
                You need to be {MINIMUM_AGE} or older to use Wasif Lay.
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-stone-500">
                Nobody sees this. It keeps younger members protected.
              </p>
            )}
          </div>
        </div>

        <button
          onClick={submit}
          disabled={!valid || saving}
          className="mt-8 w-full rounded-lg bg-emerald-800 px-4 py-3.5 font-medium text-stone-0 transition hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Let's go"}
        </button>
      </div>
    </main>
  );
}
