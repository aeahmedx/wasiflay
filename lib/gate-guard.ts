import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getGateState, type GateState } from "@/lib/queries/gate";

export const PREVIEW_COOKIE = "wl_preview";

/**
 * Whether this request should see the gate instead of the app.
 *
 * Three ways past it:
 *
 *   the gate is open        — the normal state, forever, after launch
 *   you are staff           — you have to be able to seed and test
 *   you hold a preview pass — ?preview=1, for showing someone early
 *
 * Signed-in people are NOT exempt. Someone who signs up on Monday and
 * lands in an app with no posts, no rooms and nothing happening
 * concludes it's dead — the gate is doing them a favour by holding the
 * moment until there's something to arrive to.
 */
export async function shouldShowGate(
  client: SupabaseClient,
  isStaff: boolean
): Promise<{ blocked: boolean; state: GateState }> {
  const state = await getGateState(client);

  if (state.is_open) return { blocked: false, state };
  if (isStaff) return { blocked: false, state };

  const jar = await cookies();
  if (jar.get(PREVIEW_COOKIE)?.value === "1") {
    return { blocked: false, state };
  }

  return { blocked: true, state };
}
