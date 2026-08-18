import type { SupabaseClient } from "@supabase/supabase-js";

export type SearchResult = {
  result_kind: "listing" | "post";
  id: string;
  title: string;
  subtitle: string;
  region: string | null;
  metric: number;
  created_at: string;
  rank: number;
};

export type SearchResponse = {
  listings: SearchResult[];
  posts: SearchResult[];
  total: number;
};

const EMPTY: SearchResponse = { listings: [], posts: [], total: 0 };

/**
 * Everything goes through the search_all RPC. It runs one Postgres
 * full-text query across listings and posts, ranks listings above posts,
 * and treats a null region as "everywhere" so nationwide items surface in
 * every regional search.
 *
 * Never replace this with ad-hoc ilike scans — those miss stemming,
 * ignore the transliteration aliases on listings, and get slow fast.
 */
export async function searchAll(
  client: SupabaseClient,
  query: string,
  region: string | null
): Promise<SearchResponse> {
  const q = query.trim();
  if (q.length === 0) return EMPTY;

  const { data, error } = await client.rpc("search_all", {
    q,
    filter_region: region,
  });

  if (error) throw error;

  const rows = (data ?? []) as SearchResult[];
  return {
    listings: rows.filter((r) => r.result_kind === "listing"),
    posts: rows.filter((r) => r.result_kind === "post"),
    total: rows.length,
  };
}

/**
 * The 25 terms someone will actually type at a tournament. Used as
 * suggestion chips on the empty search screen, and as the checklist for
 * seeding: every one of these must return something real before launch.
 */
export const COMMON_SEARCHES = [
  "lawyer",
  "housing",
  "mechanic",
  "passport",
  "immigration",
  "tutor",
  "doctor",
  "dentist",
  "halal",
  "jobs",
  "apartment",
  "visa",
  "school",
  "barber",
  "contractor",
  "accountant",
  "taxes",
  "shipping",
  "travel",
  "wedding",
  "insurance",
  "translation",
  "daycare",
  "moving",
  "restaurant",
] as const;
