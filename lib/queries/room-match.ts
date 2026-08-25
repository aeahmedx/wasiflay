import type { SupabaseClient } from "@supabase/supabase-js";
import type { MatchStatus } from "@/lib/queries/predictions";

export type RoomMatch = {
  id: string;
  home_team: string;
  away_team: string;
  kicks_off_at: string;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  locked_at: string | null;
};

export type NextFixture = {
  id: string;
  home_team: string;
  away_team: string;
  kicks_off_at: string;
  room_slug: string | null;
};

/** The match a room belongs to, if it belongs to one. */
export async function getRoomMatch(
  client: SupabaseClient,
  roomId: string
): Promise<RoomMatch | null> {
  const { data, error } = await client.rpc("room_match", { p_room: roomId });
  if (error) return null;
  const rows = (data ?? []) as RoomMatch[];
  return rows[0] ?? null;
}

/**
 * The next fixture after this one — what a closed room points at.
 * Somewhere to go beats a dead end.
 */
export async function getNextFixture(
  client: SupabaseClient,
  matchId: string
): Promise<NextFixture | null> {
  const { data, error } = await client.rpc("next_match_after", {
    p_match: matchId,
  });
  if (error) return null;
  const rows = (data ?? []) as NextFixture[];
  return rows[0] ?? null;
}
