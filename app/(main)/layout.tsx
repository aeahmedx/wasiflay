import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { profileExists } from "@/lib/queries/profiles";

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

  return <>{children}</>;
}
