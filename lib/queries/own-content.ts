import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReportTarget } from "@/lib/queries/moderation";

/**
 * Deletes something you wrote. Soft: the row is flagged rather than
 * dropped, so answers under a deleted post survive and there is a trail
 * if the deletion was to cover something. It disappears from every
 * surface either way.
 *
 * Ownership is checked inside the RPC, so a forged id fails server-side.
 */
export async function deleteOwnContent(
  client: SupabaseClient,
  target: Extract<ReportTarget, "post" | "answer" | "message">,
  id: string
): Promise<boolean> {
  const { data, error } = await client.rpc("delete_own_content", {
    p_target: target,
    p_id: id,
  });
  if (error) throw error;
  return Boolean(data);
}
