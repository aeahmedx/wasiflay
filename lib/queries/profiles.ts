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
