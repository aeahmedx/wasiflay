"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createProfile } from "@/lib/queries/profiles";
import { getRegions, type Region } from "@/lib/queries/regions";
import { safeNext } from "@/lib/safe-next";
import { MINIMUM_AGE } from "@/lib/legal";

const FLAGS = [
  { code: "SD", label: "Sudan" },
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "CA", label: "Canada" },
  { code: "EG", label: "Egypt" },
  { code: "AE", label: "United Arab Emirates" },
  { code: "SA", label: "Saudi Arabia" },
  { code: "QA", label: "Qatar" },
  { code: "ET", label: "Ethiopia" },
  { code: "KE", label: "Kenya" },
  { code: "AU", label: "Australia" },
  { code: "OTHER", label: "Somewhere else" },
];

function yearsSince(dob: string): number {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return NaN;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [regions, setRegions] = useState<Region[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [dob, setDob] = useState("");
  const [flag, setFlag] = useState("SD");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    getRegions(supabase)
      .then(setRegions)
      .catch(() => setError("Couldn't load regions. Reload the page."));

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/signup");
        return;
      }
      setUserId(data.user.id);
      setChecking(false);
    });
  }, [router]);

  const age = dob ? yearsSince(dob) : NaN;
  const tooYoung = !Number.isNaN(age) && age < MINIMUM_AGE;
  const isMinor = !Number.isNaN(age) && age >= MINIMUM_AGE && age < 18;

  const valid =
    displayName.trim().length >= 2 &&
    displayName.trim().length <= 50 &&
    region.length > 0 &&
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
        region,
        city: city.trim() || null,
        date_of_birth: dob,
        country_flag: flag,
      });
      /**
       * Read at the moment it's used rather than held in state.
       *
       * It was being set from the URL at the top of an effect, which
       * updates state during mount and costs a second render pass
       * before paint. Nothing renders this value — it is only ever the
       * destination after saving — so there was never a reason for it
       * to be state.
       */
      router.replace(
        safeNext(new URLSearchParams(window.location.search).get("next"))
      );
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        msg.includes("duplicate")
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
          Set up your profile
        </h1>
        <p className="mt-2 mb-8 text-stone-600">
          This is how the community will see you.
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
          </div>

          <div>
            <label
              htmlFor="region"
              className="block text-sm font-medium text-stone-800 mb-1.5"
            >
              Your community
            </label>
            <select
              id="region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full rounded-lg border border-stone-300 bg-stone-0 px-3.5 py-3 text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-800"
            >
              <option value="" disabled>
                Choose a region
              </option>
              {regions.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.name}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-stone-500">
              Pick the metro area you&apos;re part of, not just your town.
            </p>
          </div>

          <div>
            <label
              htmlFor="city"
              className="block text-sm font-medium text-stone-800 mb-1.5"
            >
              Town{" "}
              <span className="font-normal text-stone-500">(optional)</span>
            </label>
            <input
              id="city"
              dir="auto"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="New York City"
              className="w-full rounded-lg border border-stone-300 bg-stone-0 px-3.5 py-3 text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-800"
            />
          </div>

          <div>
            <label
              htmlFor="flag"
              className="block text-sm font-medium text-stone-800 mb-1.5"
            >
              Where you&apos;re from
            </label>
            <select
              id="flag"
              value={flag}
              onChange={(e) => setFlag(e.target.value)}
              className="w-full rounded-lg border border-stone-300 bg-stone-0 px-3.5 py-3 text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-800"
            >
              {FLAGS.map((f) => (
                <option key={f.code} value={f.code}>
                  {f.label}
                </option>
              ))}
            </select>
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
            {tooYoung && (
              <p className="mt-2 text-sm text-red-700">
                You need to be {MINIMUM_AGE} or older to use Wasif Lay.
              </p>
            )}
            {isMinor && (
              <p className="mt-2 text-sm text-stone-600">
                Your town stays private.
              </p>
            )}
          </div>
        </div>

        <button
          onClick={submit}
          disabled={!valid || saving}
          className="mt-8 w-full rounded-lg bg-emerald-800 px-4 py-3.5 font-medium text-stone-0 transition hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Continue"}
        </button>
      </div>
    </main>
  );
}
