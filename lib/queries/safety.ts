import type { SupabaseClient } from "@supabase/supabase-js";

// ---- blocking ---------------------------------------------------------

export type BlockedPerson = {
  blocked_id: string;
  display_name: string | null;
  created_at: string;
};

export async function blockUser(
  client: SupabaseClient,
  blockerId: string,
  blockedId: string
): Promise<void> {
  const { error } = await client
    .from("blocks")
    .insert({ blocker_id: blockerId, blocked_id: blockedId });
  // 23505 = already blocked. Idempotent by design.
  if (error && error.code !== "23505") throw error;
}

export async function unblockUser(
  client: SupabaseClient,
  blockerId: string,
  blockedId: string
): Promise<void> {
  const { error } = await client
    .from("blocks")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId);
  if (error) throw error;
}

/**
 * Blocking hides people from public_profiles, so a blocked person's name
 * can't be read back through the normal path — which is correct
 * everywhere except the screen where you manage your own blocks. The
 * ids come from `blocks`; names are looked up separately and fall back
 * to "Blocked member" when unavailable.
 */
export async function listBlocked(
  client: SupabaseClient,
  blockerId: string
): Promise<BlockedPerson[]> {
  const { data, error } = await client
    .from("blocks")
    .select("blocked_id, created_at")
    .eq("blocker_id", blockerId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as { blocked_id: string; created_at: string }[]).map(
    (b) => ({ ...b, display_name: null })
  );
}

/** Ids to filter out of anything the database can't filter for us —
 *  realtime message events arrive raw, bypassing the masking views. */
export async function blockedIds(
  client: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data, error } = await client
    .from("blocks")
    .select("blocked_id")
    .eq("blocker_id", userId);

  if (error) return [];
  return ((data ?? []) as { blocked_id: string }[]).map((b) => b.blocked_id);
}

// ---- account ----------------------------------------------------------

export async function deleteOwnAccount(
  client: SupabaseClient
): Promise<void> {
  const { error } = await client.rpc("delete_own_account");
  if (error) throw error;
}

export async function exportMyData(
  client: SupabaseClient
): Promise<unknown> {
  const { data, error } = await client.rpc("export_my_data");
  if (error) throw error;
  return data;
}

// ---- kill switch ------------------------------------------------------

export type SiteSettings = {
  read_only: boolean;
  notice: string | null;
};

export async function getSiteSettings(
  client: SupabaseClient
): Promise<SiteSettings> {
  const { data, error } = await client
    .from("site_settings")
    .select("read_only, notice")
    .maybeSingle();

  // Fail open: a settings read failing shouldn't freeze the site.
  if (error || !data) return { read_only: false, notice: null };
  return data as SiteSettings;
}

export async function setReadOnly(
  client: SupabaseClient,
  on: boolean,
  notice: string | null
): Promise<void> {
  const { error } = await client.rpc("set_read_only", {
    p_on: on,
    p_notice: notice,
  });
  if (error) throw error;
}
