import type { SupabaseClient } from "@supabase/supabase-js";

export type ReportTarget =
  | "post"
  | "answer"
  | "message"
  | "listing"
  | "profile";

export type ReportStatus = "open" | "actioned" | "dismissed";

export type QueueItem = {
  report_id: string;
  target_type: ReportTarget;
  target_id: string;
  reason: string;
  status: ReportStatus;
  reported_at: string;
  reporter_id: string | null;
  reporter_name: string | null;
  author_id: string | null;
  author_name: string | null;
  preview: string | null;
  is_anonymous: boolean;
  is_removed: boolean;
  author_banned: boolean;
};

/** Anyone signed in can report. */
export async function createReport(
  client: SupabaseClient,
  input: {
    reporter_id: string;
    target_type: ReportTarget;
    target_id: string;
    reason: string;
  }
): Promise<void> {
  const { error } = await client.from("reports").insert(input);
  if (error) throw error;
}

/**
 * Staff only — enforced inside the RPC, not here. The function is
 * SECURITY DEFINER because the panel needs author_id and the content of
 * removed items, neither of which clients can read directly.
 */
export async function getReportQueue(
  client: SupabaseClient,
  status: ReportStatus = "open"
): Promise<QueueItem[]> {
  const { data, error } = await client.rpc("mod_report_queue", {
    p_status: status,
    p_limit: 100,
  });
  if (error) throw error;
  return (data ?? []) as QueueItem[];
}

export async function getOpenReportCount(
  client: SupabaseClient
): Promise<number> {
  const { data, error } = await client.rpc("mod_open_report_count");
  if (error) return 0;
  return (data as number) ?? 0;
}

// ---- actions. All guarded server-side by is_staff() / is_admin(). ----

export async function modRemove(
  client: SupabaseClient,
  target: ReportTarget,
  id: string
): Promise<void> {
  const { error } = await client.rpc("mod_remove", {
    p_target: target,
    p_id: id,
  });
  if (error) throw error;
}

export async function modRestore(
  client: SupabaseClient,
  target: ReportTarget,
  id: string
): Promise<void> {
  const { error } = await client.rpc("mod_restore", {
    p_target: target,
    p_id: id,
  });
  if (error) throw error;
}

export async function modSetBan(
  client: SupabaseClient,
  userId: string,
  banned: boolean
): Promise<void> {
  const { error } = await client.rpc("mod_set_ban", {
    p_user: userId,
    p_banned: banned,
  });
  if (error) throw error;
}

export async function modResolveReport(
  client: SupabaseClient,
  reportId: string,
  status: ReportStatus
): Promise<void> {
  const { error } = await client.rpc("mod_resolve_report", {
    p_report: reportId,
    p_status: status,
  });
  if (error) throw error;
}
