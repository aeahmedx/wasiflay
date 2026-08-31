import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  countUpcoming,
  getLatestResult,
  getLiveMatches,
  getMyStanding,
  getNextSlot,
} from "@/lib/queries/predictions";
import { TournamentBlock } from "@/components/matches/tournament-block";

/**
 * The tournament strip, on the home screen.
 *
 * Fetches a slot rather than a list. Four fields run simultaneously, so
 * the next kickoff always brings four fixtures with it — and holding to
 * that unit is what stops this block growing with the schedule. Thirty
 * one matches or three hundred, it asks for the same amount.
 *
 * Renders nothing with no matches, which is the rule for this whole
 * layer: the app is exactly what it was before predictions existed.
 */
export async function NowBlock({ userId }: { userId: string | null }) {
  const supabase = await createClient();

  const [live, nextSlot, result] = await Promise.all([
    getLiveMatches(supabase),
    getNextSlot(supabase),
    getLatestResult(supabase),
  ]);

  if (live.length === 0 && nextSlot.length === 0 && !result) return null;

  const [upcomingCount, standing] = await Promise.all([
    countUpcoming(supabase),
    userId ? getMyStanding(supabase) : Promise.resolve(null),
  ]);

  // "You've seen this result" — the block opens collapsed rather than
  // the result vanishing.
  const seen = (await cookies()).get("wl_seen_result")?.value;

  return (
    <TournamentBlock
      result={result}
      live={live}
      nextSlot={nextSlot}
      upcomingCount={upcomingCount}
      standing={standing}
      userId={userId}
      startCollapsed={Boolean(result) && seen === result?.id}
    />
  );
}
