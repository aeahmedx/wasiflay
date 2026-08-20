import type { SupabaseClient } from "@supabase/supabase-js";

export type ReportTarget =
    | "post"
    | "answer"
    | "message"
    | "listing"
    | "profile"
    // Added to the database enum in 0026; the union has to match or the
    // report button can't target an event.
    | "event";

export type ReportStatus = "open" | "actioned" | "dismissed";

export type UserRole = "member" | "moderator" | "admin";

/** One row per reported thing, not per report (0014). */
export type QueueItem = {
  target_type: ReportTarget;
  target_id: string;
  report_count: number;
  reasons: string | null;
  first_reported: string;
  last_reported: string;
  reporter_names: string | null;
  author_id: string | null;
  author_name: string | null;
  author_role: UserRole | null;
  author_banned: boolean;
  preview: string | null;
  image_url: string | null;
  is_anonymous: boolean;
  is_removed: boolean;
  claimed_by: string | null;
  claimed_name: string | null;
  claim_fresh: boolean;
};

export type ModUser = {
  id: string;
  display_name: string;
  region: string | null;
  city: string | null;
  country_flag: string | null;
  role: UserRole;
  is_banned: boolean;
  is_minor: boolean;
  contribution_count: number;
  helpful_count: number;
  joined_at: string;
  open_reports: number;
};

// ---- reporting (any signed-in user) ---------------------------------

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

// ---- queue -----------------------------------------------------------

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

/** Returns false when someone else already holds a live claim. */
export async function claimTarget(
    client: SupabaseClient,
    target: ReportTarget,
    id: string
): Promise<boolean> {
  const { data, error } = await client.rpc("mod_claim_target", {
    p_target: target,
    p_id: id,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function releaseTarget(
    client: SupabaseClient,
    target: ReportTarget,
    id: string
): Promise<void> {
  const { error } = await client.rpc("mod_release_target", {
    p_target: target,
    p_id: id,
  });
  if (error) throw error;
}

/** Resolves every open report against one target. */
export async function resolveTarget(
    client: SupabaseClient,
    target: ReportTarget,
    id: string,
    status: ReportStatus
): Promise<number> {
  const { data, error } = await client.rpc("mod_resolve_target", {
    p_target: target,
    p_id: id,
    p_status: status,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

// ---- actions ---------------------------------------------------------

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

// ---- people ----------------------------------------------------------

export async function findUsers(
    client: SupabaseClient,
    query: string,
    bannedOnly = false
): Promise<ModUser[]> {
  const { data, error } = await client.rpc("mod_find_users", {
    p_query: query,
    p_banned_only: bannedOnly,
    p_limit: 50,
  });
  if (error) throw error;
  return (data ?? []) as ModUser[];
}

export async function purgeUser(
    client: SupabaseClient,
    userId: string
): Promise<number> {
  const { data, error } = await client.rpc("mod_purge_user", {
    p_user: userId,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}


/**
 * Permanent deletion. Admin only, irreversible, and it cleans up the
 * rows that have no foreign key to cascade through — votes and reports.
 * Returns the number of top-level rows removed.
 */
export async function adminHardDelete(
    client: SupabaseClient,
    target: ReportTarget,
    id: string
): Promise<number> {
  const { data, error } = await client.rpc("admin_hard_delete", {
    p_target: target,
    p_id: id,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}