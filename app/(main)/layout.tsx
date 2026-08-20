import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { profileExists } from "@/lib/queries/profiles";
import { getUnreadCount } from "@/lib/queries/notifications";
import { InstallPrompt } from "@/components/install-prompt";
import { TabBar } from "@/components/tab-bar";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { TermsGate } from "@/components/terms-gate";
import { ReadOnlyBanner } from "@/components/read-only-banner";
import { getCurrentProfile } from "@/lib/queries/profiles.server";
import { TERMS_VERSION } from "@/lib/legal";

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
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const hasProfile = await profileExists(supabase, user.id);
    if (!hasProfile) redirect("/onboarding");
  }

  // Seeded server-side so the badge never flashes a wrong number; the
  // bar keeps it current over realtime from there.
  const unread = user ? await getUnreadCount(supabase) : 0;

  const profile = user ? await getCurrentProfile() : null;
  const needsTerms =
    profile !== null && profile.terms_version !== TERMS_VERSION;

  return (
    <>
      {/* Installed as a PWA there's no browser chrome, so the reflex of
          swiping down to refresh would otherwise do nothing. */}
      <PullToRefresh />
      <ReadOnlyBanner />
      {children}
      <TabBar userId={user?.id ?? null} initialUnread={unread} />
      {/* Rendered last so it sits above everything, including the tab
          bar. The legal pages themselves stay reachable underneath —
          being asked to accept terms you can't open would be absurd. */}
      {needsTerms && profile && (
        <TermsGate userId={profile.id} isMinor={profile.is_minor} />
      )}
      {/* Not on signup or onboarding — interrupting someone mid-signup to
          ask them to install is the wrong moment. */}
      <InstallPrompt />
    </>
  );
}
