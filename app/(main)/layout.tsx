import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { profileExists } from "@/lib/queries/profiles";
import { getCurrentProfile } from "@/lib/queries/profiles.server";
import { getUnreadCount } from "@/lib/queries/notifications";
import { TERMS_VERSION } from "@/lib/legal";
import { TabBar } from "@/components/tab-bar";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { InstallPrompt } from "@/components/install-prompt";
import { TermsGate } from "@/components/terms-gate";
import { ReadOnlyBanner } from "@/components/read-only-banner";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { SessionWatch } from "@/components/session-watch";
import { ConnectionStatus } from "@/components/connection-status";
import { shouldShowGate } from "@/lib/gate-guard";
import { OnboardingTour } from "@/components/onboarding-tour";
import { PrizeSplash } from "@/components/prize-splash";

/**
 * Profile gate (SPEC 2.2).
 *
 * Between auth success and the profile insert, is_active_user() returns
 * false and every write is rejected by RLS. So an authenticated user
 * without a profile row is sent to onboarding before reaching the app.
 *
 * Unauthenticated users pass through — reading is open (SPEC 1).
 */
export default async function MainLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const hasProfile = await profileExists(supabase, user.id);
    if (!hasProfile) redirect("/onboarding");
  }

  /**
   * The gate, before anything else renders.
   *
   * Everything in this route group funnels through here, so one check
   * covers the feed, rooms, search, events and profiles — rather than
   * each page remembering to ask. The gate page itself sits outside
   * this group, as do the legal pages: being asked to accept terms you
   * cannot open would be absurd.
   */
  const gateProfile = user ? await getCurrentProfile() : null;
  const isStaff =
    gateProfile?.role === "moderator" || gateProfile?.role === "admin";

  const { blocked } = await shouldShowGate(supabase, isStaff);
  if (blocked) redirect("/gate");

  /**
   * The tour, once, for anyone who has an account and hasn't seen it.
   *
   * Deliberately after the gate check: it explains an app you can
   * actually use, and running it behind a countdown would explain
   * rooms and feeds that are still shut.
   *
   * A cookie rather than a column — it's a UI preference, not a fact
   * about the person, and the worst case is seeing it once more on a
   * second device.
   */
  const jar = await cookies();
  const needsTour = user !== null && jar.get("wl_tour")?.value !== "1";

  // Seeded server-side so the badge never flashes a wrong number; the
  // bar keeps it current over realtime from there.
  const unread = user ? await getUnreadCount(supabase) : 0;

  const profile = gateProfile;
  const needsTerms =
    profile !== null && profile.terms_version !== TERMS_VERSION;

  return (
    <>
      {/* A slim bar rather than a full-page takeover — losing signal
          mid-session shouldn't blank out content that's still readable.
          The service worker covers the cold-start case, where there
          genuinely is nothing to show. */}
      <PrizeSplash />

      {needsTour && <OnboardingTour />}

      <ConnectionStatus />

      <PullToRefresh />
      <ReadOnlyBanner />

      {children}

      <TabBar userId={user?.id ?? null} initialUnread={unread} />

      <InstallPrompt />
      <ServiceWorkerRegister />
      <SessionWatch hadSession={Boolean(user)} />

      {/* Last, so it sits above everything including the tab bar. The
          legal pages stay reachable underneath — being asked to accept
          terms you can't open would be absurd. */}
      {needsTerms && profile && (
        <TermsGate userId={profile.id} isMinor={profile.is_minor} />
      )}
    </>
  );
}
