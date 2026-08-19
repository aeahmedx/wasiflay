import type { SupabaseClient } from "@supabase/supabase-js";

export type Notification = {
  id: string;
  kind: string;
  post_id: string | null;
  post_title: string | null;
  answer_id: string | null;
  message_id: string | null;
  actor_name: string | null; // withheld for helpful votes and removals // "Anonymous" when the answer was anonymous
  is_anonymous: boolean;
  is_read: boolean;
  created_at: string;
};

export async function getMyNotifications(
  client: SupabaseClient,
  limit = 50
): Promise<Notification[]> {
  const { data, error } = await client.rpc("my_notifications", {
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as Notification[];
}

export async function getUnreadCount(
  client: SupabaseClient
): Promise<number> {
  const { data, error } = await client.rpc("my_unread_count");
  if (error) return 0;
  return (data as number) ?? 0;
}

/** Passing no ids marks everything read. */
export async function markRead(
  client: SupabaseClient,
  ids?: string[]
): Promise<number> {
  const { data, error } = await client.rpc("mark_notifications_read", {
    p_ids: ids ?? null,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

// ---- SMS opt-in -------------------------------------------------------

/**
 * Phone enrollment goes through Supabase Auth, not a column we manage.
 * The number lands in auth.users, which no client query can read — only
 * the server-side send job sees it, through the service role.
 */
export async function startPhoneEnrollment(
  client: SupabaseClient,
  phone: string
): Promise<void> {
  const { error } = await client.auth.updateUser({ phone });
  if (error) throw error;
}

export async function confirmPhoneEnrollment(
  client: SupabaseClient,
  phone: string,
  token: string
): Promise<void> {
  const { error } = await client.auth.verifyOtp({
    phone,
    token,
    type: "phone_change",
  });
  if (error) throw error;
}

export async function setSmsOptIn(
  client: SupabaseClient,
  userId: string,
  optIn: boolean
): Promise<void> {
  const { error } = await client
    .from("profiles")
    .update({ sms_opt_in: optIn })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Normalises to E.164, assuming US when no country code is given —
 * Twilio rejects anything else, and a rejected number looks to the user
 * like the app is broken.
 */
export function toE164(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) {
    return digits.length >= 8 && digits.length <= 16 ? digits : null;
  }
  const bare = digits.replace(/\D/g, "");
  if (bare.length === 10) return `+1${bare}`;
  if (bare.length === 11 && bare.startsWith("1")) return `+${bare}`;
  return null;
}
