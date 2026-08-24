import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  getLatestResult,
  getLiveMatches,
  getMyStanding,
  getNextMatch,
  getUpcomingMatches,
} from "@/lib/queries/predictions";
import { TournamentBlock } from "@/components/matches/tournament-block";

/**
 * Renders nothing when there is no tournament.
 *
 * That's the rule for this whole layer: with no matches in the database
 * the app is exactly what it was before predictions existed. Nothing to
 * switch off afterwards — it appears and disappears with the data.
 */
export async function NowBlock({ userId }: { userId: string | null }) {
  const supabase = await createClient();

  const [live, next, result] = await Promise.all([
    getLiveMatches(supabase),
    getNextMatch(supabase),
    getLatestResult(supabase),
  ]);

  if (live.length === 0 && !next && !result) return null;

  const [upcoming, standing] = await Promise.all([
    getUpcomingMatches(supabase, next?.id ?? null, 6),
    userId ? getMyStanding(supabase) : Promise.resolve(null),
  ]);

  // The cookie means "you've seen this result", so the block opens
  // collapsed rather than disappearing.
  const seen = (await cookies()).get("wl_seen_result")?.value;

  return (
    <TournamentBlock
      result={result}
      live={live}
      next={next}
      upcoming={upcoming}
      standing={standing}
      userId={userId}
      startCollapsed={Boolean(result) && seen === result?.id}
    />
  );
}
