import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getPublicProfile, type PublicProfile } from "./profiles";

/**
 * Server Components only. Importing this from a "use client" file will
 * fail the build — which is the point.
 */
export async function getCurrentProfile(): Promise<PublicProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return getPublicProfile(supabase, user.id);
}
