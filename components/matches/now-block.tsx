import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentMatch,
  getLatestResult,
  getMyStanding,
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

  const [match, result] = await Promise.all([
    getCurrentMatch(supabase),
    // Not gated on being signed in: a result is news either way, and
    // someone signed out seeing the scoreboard is the point.
    getLatestResult(supabase),
  ]);

  if (!match && !result) return null;

  const standing = userId ? await getMyStanding(supabase) : null;

  // The cookie means "you've seen this result", so the block opens
  // collapsed rather than disappearing.
  const seen = (await cookies()).get("wl_seen_result")?.value;

  return (
    <TournamentBlock
      result={result}
      match={match}
      standing={standing}
      userId={userId}
      startCollapsed={Boolean(result) && seen === result?.id}
    />
  );
}
