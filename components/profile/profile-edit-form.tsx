"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { createClient } from "@/lib/supabase/client";
import { updateProfile, type PublicProfile } from "@/lib/queries/profiles";
import type { Region } from "@/lib/queries/regions";

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

export function ProfileEditForm({
                                  profile,
                                  regions,
                                }: {
  profile: PublicProfile;
  regions: Region[];
}) {
  const router = useRouter();

  const [displayName, setDisplayName] = useState(profile.display_name);
  const [region, setRegion] = useState(profile.region);
  const [city, setCity] = useState(profile.city ?? "");
  const [flag, setFlag] = useState(profile.country_flag ?? "SD");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid =
      displayName.trim().length >= 2 &&
      displayName.trim().length <= 50 &&
      region.length > 0;

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      await updateProfile(supabase, profile.id, {
        display_name: displayName.trim(),
        region,
        city: city.trim() || null,
        country_flag: flag,
      });
      router.replace(`/profile/${profile.id}`);
      router.refresh();
    } catch {
      setError("Couldn't save. Check your connection and try again.");
      setSaving(false);
    }
  }

  return (
      <main className="min-h-dvh bg-stone-50 px-4 py-6">
        <div className="max-w-sm mx-auto">
          <BackLink fallback={`/profile/${profile.id}`} />

          <h1 className="mt-4 mb-6 text-2xl font-semibold tracking-tight text-stone-900">
            Edit profile
          </h1>

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
                {regions.map((r) => (
                    <option key={r.slug} value={r.slug}>
                      {r.name}
                    </option>
                ))}
              </select>
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
          </div>

          <button
              onClick={save}
              disabled={!valid || saving}
              className="mt-8 w-full rounded-lg bg-emerald-800 px-4 py-3.5 font-medium text-stone-0 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </main>
  );
}