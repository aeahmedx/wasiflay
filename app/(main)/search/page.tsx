import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profiles.server";
import { getRegions } from "@/lib/queries/regions";
import { SearchView } from "@/components/search/search-view";
import { ErrorBoundary } from "@/components/error-boundary";

export default async function SearchPage() {
  const supabase = await createClient();
  const [regions, profile] = await Promise.all([
    getRegions(supabase),
    getCurrentProfile(),
  ]);

  return (
    <ErrorBoundary label="Search">
      <SearchView regions={regions} defaultRegion={profile?.region ?? null} />
    </ErrorBoundary>
  );
}
