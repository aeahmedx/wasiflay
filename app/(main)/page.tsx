import Link from "next/link";
import { getCurrentProfile } from "@/lib/queries/profiles.server";
import { SignOutButton } from "./sign-out-button";

// Temporary. Replaced by the real Home feed in SPEC section 3.
export default async function HomePage() {
  const profile = await getCurrentProfile();

  return (
    <main className="min-h-dvh bg-stone-50 px-6 py-12">
      <div className="max-w-sm mx-auto">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900 mb-6">
          Wasif Lay
        </h1>

        {profile ? (
          <div className="rounded-lg border border-stone-200 bg-white p-5">
            <p className="text-lg font-medium text-stone-900" dir="auto">
              {profile.display_name}
            </p>
            <p className="text-stone-600 mt-0.5">
              {profile.city ?? "City private"} · {profile.country_flag}
            </p>
            <dl className="mt-4 flex gap-6 text-sm">
              <div>
                <dt className="text-stone-500">Contributions</dt>
                <dd className="text-stone-900 font-medium">
                  {profile.contribution_count}
                </dd>
              </div>
              <div>
                <dt className="text-stone-500">Helpful answers</dt>
                <dd className="text-stone-900 font-medium">
                  {profile.helpful_count}
                </dd>
              </div>
            </dl>
            <div className="mt-5 flex items-center gap-4">
              <Link
                href="/rooms"
                className="text-sm text-emerald-800 underline underline-offset-4"
              >
                Rooms
              </Link>
              <SignOutButton />
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-stone-200 bg-white p-5">
            <p className="text-stone-600 mb-4">
              Sign in to ask questions and answer others.
            </p>
            <Link
              href="/signup"
              className="inline-block rounded-lg bg-emerald-800 px-4 py-2.5 font-medium text-white hover:bg-emerald-900"
            >
              Continue with Google
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
