import type { SupabaseClient } from "@supabase/supabase-js";

export type MatchRound = "group" | "quarter" | "semi" | "final";
export type MatchStatus = "scheduled" | "locked" | "finished" | "cancelled";

export type Match = {
  id: string;
  home_team: string;
  away_team: string;
  kicks_off_at: string;
  round: MatchRound;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  locked_at: string | null;
  room_id: string | null;
  room_slug: string | null;
  is_open: boolean;
  prediction_count: number;
  /** Your own pick, always visible to you even before kickoff. */
  my_home: number | null;
  my_away: number | null;
  my_points: number | null;
  my_tier: string | null;
  created_at: string;
};

// One string literal, not a concatenation: Supabase parses this at
// compile time to type the result, and a built-up string types as an
// error instead.
const MATCH_FIELDS =
  "id, home_team, away_team, kicks_off_at, round, status, home_score, away_score, locked_at, room_id, room_slug, is_open, prediction_count, my_home, my_away, my_points, my_tier, created_at";

export const ROUND_LABEL: Record<MatchRound, string> = {
  group: "Group",
  quarter: "Quarter-final",
  semi: "Semi-final",
  final: "Final",
};

export const ROUND_MULTIPLIER: Record<MatchRound, number> = {
  group: 1,
  quarter: 1.5,
  semi: 2,
  final: 3,
};

// ---- reading ----------------------------------------------------------

export async function getMatches(
  client: SupabaseClient,
  limit = 50
): Promise<Match[]> {
  const { data, error } = await client
    .from("public_matches")
    .select(MATCH_FIELDS)
    .order("kicks_off_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as unknown as Match[];
}

export async function getMatch(
  client: SupabaseClient,
  id: string
): Promise<Match | null> {
  const { data, error } = await client
    .from("public_matches")
    .select(MATCH_FIELDS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as Match | null;
}

/**
 * The one match worth putting at the top of the app: whatever is live,
 * or the next one to kick off. This is what makes the home screen answer
 * "what should I do right now" during a tournament.
 */
export async function getCurrentMatch(
  client: SupabaseClient
): Promise<Match | null> {
  const since = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

  const { data, error } = await client
    .from("public_matches")
    .select(MATCH_FIELDS)
    .neq("status", "finished")
    .gte("kicks_off_at", since)
    .order("kicks_off_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data as unknown as Match | null;
}

export type PublicPrediction = {
  match_id: string;
  user_id: string;
  display_name: string;
  country_flag: string | null;
  home_score: number;
  away_score: number;
  points: number | null;
  tier: string | null;
  created_at: string;
};

/**
 * Everyone's picks. The view returns only your own until the match
 * closes, so this is safe to call at any time — there's nothing to leak.
 */
export async function getMatchPredictions(
  client: SupabaseClient,
  matchId: string
): Promise<PublicPrediction[]> {
  const { data, error } = await client
    .from("public_predictions")
    .select(
      "match_id, user_id, display_name, country_flag, home_score, away_score, points, tier, created_at"
    )
    .eq("match_id", matchId)
    .order("points", { ascending: false, nullsFirst: false });

  if (error) throw error;
  return (data ?? []) as unknown as PublicPrediction[];
}

// ---- predicting -------------------------------------------------------

export class MatchClosedError extends Error {}

export async function predict(
  client: SupabaseClient,
  matchId: string,
  userId: string,
  home: number,
  away: number
): Promise<void> {
  const { error } = await client
    .from("predictions")
    .upsert(
      { match_id: matchId, user_id: userId, home_score: home, away_score: away },
      { onConflict: "match_id,user_id" }
    );

  if (error) {
    if (error.message.includes("MATCH_CLOSED")) {
      throw new MatchClosedError("Picks are closed for this match.");
    }
    throw error;
  }
}

// ---- leaderboard ------------------------------------------------------

export type LeaderRow = {
  rank: number;
  user_id: string;
  display_name: string;
  country_flag: string | null;
  points: number;
  exact_count: number;
  played: number;
  is_me: boolean;
};

export async function getLeaderboard(
  client: SupabaseClient,
  limit = 50
): Promise<LeaderRow[]> {
  const { data, error } = await client.rpc("leaderboard", { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as LeaderRow[];
}

export type Standing = {
  rank: number;
  points: number;
  exact_count: number;
  played: number;
  total: number;
  /** Points needed to pass the person above — the gap is what brings
   *  someone back, more than the rank itself. */
  gap_above: number;
};

export async function getMyStanding(
  client: SupabaseClient
): Promise<Standing | null> {
  const { data, error } = await client.rpc("my_standing");
  if (error) return null;
  const rows = (data ?? []) as Standing[];
  return rows[0] ?? null;
}

// ---- staff ------------------------------------------------------------

export type StaffMatch = {
  id: string;
  home_team: string;
  away_team: string;
  kicks_off_at: string;
  round: MatchRound;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  locked_at: string | null;
  room_id: string | null;
  room_slug: string | null;
  prediction_count: number;
};

export async function getStaffMatches(
  client: SupabaseClient
): Promise<StaffMatch[]> {
  const { data, error } = await client.rpc("staff_match_list", {
    p_limit: 100,
  });
  if (error) throw error;
  return (data ?? []) as StaffMatch[];
}

export async function createMatch(
  client: SupabaseClient,
  home: string,
  away: string,
  kickoffIso: string,
  round: MatchRound
): Promise<string> {
  const { data, error } = await client.rpc("create_match", {
    p_home: home,
    p_away: away,
    p_kickoff: kickoffIso,
    p_round: round,
  });
  if (error) throw error;
  return data as string;
}

export async function updateMatch(
  client: SupabaseClient,
  id: string,
  home: string,
  away: string,
  kickoffIso: string,
  round: MatchRound
): Promise<void> {
  const { error } = await client.rpc("update_match", {
    p_match: id,
    p_home: home,
    p_away: away,
    p_kickoff: kickoffIso,
    p_round: round,
  });
  if (error) throw error;
}

export async function lockMatch(
  client: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await client.rpc("lock_match", { p_match: id });
  if (error) throw error;
}

/** Returns how many predictions were scored. Safe to call again to
 *  correct a mistake — it overwrites points rather than adding to them. */
export async function setResult(
  client: SupabaseClient,
  id: string,
  home: number,
  away: number
): Promise<number> {
  const { data, error } = await client.rpc("set_match_result", {
    p_match: id,
    p_home: home,
    p_away: away,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

export async function cancelMatch(
  client: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await client.rpc("cancel_match", { p_match: id });
  if (error) throw error;
}

// ---- display ----------------------------------------------------------

export function kickoffLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (sameDay) return time;
  return `${d.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  })}, ${time}`;
}

export const TIER_LABEL: Record<string, string> = {
  exact: "Exact score",
  margin: "Right winner and margin",
  winner: "Right winner",
  goals: "Right total goals",
  none: "No points",
};
