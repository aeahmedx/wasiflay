import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { profileExists } from "@/lib/queries/profiles";
import { getUnreadCount } from "@/lib/queries/notifications";
import { InstallPrompt } from "@/components/install-prompt";
import { TabBar } from "@/components/tab-bar";

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

  return (
    <>
      {children}
      <TabBar userId={user?.id ?? null} initialUnread={unread} />
      {/* Not on signup or onboarding — interrupting someone mid-signup to
          ask them to install is the wrong moment. */}
      <InstallPrompt />
    </>
  );
}
