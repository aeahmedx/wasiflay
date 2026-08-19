import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Client-safe. This module must NEVER import lib/supabase/server.ts —
 * that pulls next/headers into the browser bundle and breaks the build.
 * Server-only helpers live in profiles.server.ts.
 */

export type PublicProfile = {
  id: string;
  display_name: string;
  country_flag: string | null;
  role: "member" | "moderator" | "admin";
  contribution_count: number;
  helpful_count: number;
  created_at: string;
  region: string;
  city: string | null; // auto-nulled for minors by the view
  is_self: boolean;
  is_banned: boolean;  // own status only; always false for other people
  sms_opt_in: boolean; // own status only
};

/**
 * ALWAYS read display data from public_profiles, never from profiles.
 * The base table hides city / date_of_birth / is_minor / is_banned via
 * column grants. See CLAUDE.md section 3.
 */
export async function getPublicProfile(
  client: SupabaseClient,
  id: string
): Promise<PublicProfile | null> {
  const { data, error } = await client
    .from("public_profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as PublicProfile | null;
}

/** Cheap existence check for the profile gate. */
export async function profileExists(
  client: SupabaseClient,
  id: string
): Promise<boolean> {
  const { data, error } = await client
    .from("profiles")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data !== null;
}

export type CreateProfileInput = {
  id: string;
  display_name: string;
  region: string;
  city: string | null;
  date_of_birth: string; // YYYY-MM-DD
  country_flag: string;
};

export async function createProfile(
  client: SupabaseClient,
  input: CreateProfileInput
) {
  const { error } = await client.from("profiles").insert(input);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Profile pages (SPEC 8)
// ---------------------------------------------------------------------

/**
 * Country code to flag emoji. 'SD' -> 🇸🇩 via regional indicator symbols.
 * Returns '' for OTHER or anything malformed.
 */
export function flagEmoji(code: string | null): string {
  if (!code || code.length !== 2 || !/^[A-Za-z]{2}$/.test(code)) return "";
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split("")
      .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

export type ProfilePost = {
  id: string;
  title: string;
  type: "question" | "recommendation" | "announcement";
  region: string | null; // null = all regions
  answer_count: number;
  helpful_count: number;
  created_at: string;
};

export type ProfileAnswer = {
  id: string;
  post_id: string;
  body: string;
  helpful_count: number;
  created_at: string;
};

/**
 * Reads from public_posts, so anonymous posts are excluded automatically:
 * their author_id is masked to null and never matches. No filter to
 * forget, no leak to introduce later.
 */
export async function getProfilePosts(
  client: SupabaseClient,
  authorId: string,
  limit = 30
): Promise<ProfilePost[]> {
  const { data, error } = await client
    .from("public_posts")
    .select("id, title, type, region, answer_count, helpful_count, created_at")
    .eq("author_id", authorId)
    .eq("is_anonymous", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as ProfilePost[];
}

export async function getProfileAnswers(
  client: SupabaseClient,
  authorId: string,
  limit = 30
): Promise<ProfileAnswer[]> {
  const { data, error } = await client
    .from("public_answers")
    .select("id, post_id, body, helpful_count, created_at")
    .eq("author_id", authorId)
    .eq("is_anonymous", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as ProfileAnswer[];
}

/** Titles for the posts an answer belongs to. */
export async function getPostTitles(
  client: SupabaseClient,
  postIds: string[]
): Promise<Record<string, string>> {
  if (postIds.length === 0) return {};

  const { data, error } = await client
    .from("public_posts")
    .select("id, title")
    .in("id", postIds);

  if (error) throw error;

  const map: Record<string, string> = {};
  ((data ?? []) as { id: string; title: string }[]).forEach(
    (p) => (map[p.id] = p.title)
  );
  return map;
}

export async function updateProfile(
  client: SupabaseClient,
  id: string,
  input: {
    display_name: string;
    region: string;
    city: string | null;
    country_flag: string;
  }
) {
  const { error } = await client.from("profiles").update(input).eq("id", id);
  if (error) throw error;
}
