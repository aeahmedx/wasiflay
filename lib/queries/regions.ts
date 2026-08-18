import type { SupabaseClient } from "@supabase/supabase-js";

export type Region = {
  slug: string;
  name: string;
  sort_order: number;
};

/**
 * The region list lives in the database, not in a hardcoded array.
 * Adding a region is an INSERT — no deploy, no drift between the two.
 */
export async function getRegions(client: SupabaseClient): Promise<Region[]> {
  const { data, error } = await client
    .from("regions")
    .select("slug, name, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Region[];
}

export function regionName(regions: Region[], slug: string | null): string {
  if (!slug) return "";
  return regions.find((r) => r.slug === slug)?.name ?? slug;
}
