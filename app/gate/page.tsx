import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profiles.server";
import { getGateMatches, getGateState } from "@/lib/queries/gate";
import { GateView } from "@/components/gate/gate-view";
import { OG_IMAGE } from "@/lib/og";

export const metadata: Metadata = {
  title: "2026 Tournament Experience",
  description:
    "Call the scores, talk through every match, and see where you finish. Opening soon.",
  openGraph: {
    images: [OG_IMAGE],
    title: "Wasif Lay · 2026 Tournament Experience",
    description:
      "Call the scores, talk through every match, and see where you finish.",
  },
};

export default async function GatePage() {
  const supabase = await createClient();

  const [state, matches, profile] = await Promise.all([
    getGateState(supabase),
    getGateMatches(supabase),
    getCurrentProfile(),
  ]);

  // Once it's open this page has no reason to exist — anyone landing on
  // an old link goes where they were trying to go.
  if (state.is_open) redirect("/");

  /**
   * Signed in with Google but no profile yet.
   *
   * The profile row is created during onboarding, and this page sits
   * outside the (main) layout where that redirect normally happens — so
   * someone arriving straight back from Google landed here looking
   * logged out, with their picks still sitting in a cookie that nothing
   * would claim.
   *
   * Sending them through onboarding and back means the picks are
   * written the moment they return.
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && !profile) redirect("/onboarding?next=%2Fgate");

  return (
    <GateView
      state={state}
      matches={matches}
      signedIn={profile !== null}
      userId={profile?.id ?? null}
    />
  );
}
