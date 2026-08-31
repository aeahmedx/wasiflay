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

/**
 * Matches still open for picks, soonest first — the ones worth offering
 * someone who has just dealt with the match in front of them.
 */
export async function getUpcomingMatches(
  client: SupabaseClient,
  excludeId: string | null,
  limit = 6
): Promise<Match[]> {
  let query = client
    .from("public_matches")
    .select(MATCH_FIELDS)
    // Same reasoning as getNextMatch: a match locked ahead of kickoff is
    // still upcoming, it just isn't pickable.
    .neq("status", "finished")
    .gt("kicks_off_at", new Date().toISOString())
    .order("kicks_off_at", { ascending: true })
    .limit(limit + 1);

  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query;
  if (error) return [];
  return ((data ?? []) as unknown as Match[]).slice(0, limit);
}

/**
 * The most recent finished matches, with no time window.
 *
 * The block hid itself entirely once nothing was live or upcoming —
 * between the last game of the day and the next fixture being added,
 * the tournament simply vanished from the app. Results are what it has
 * to show in that gap.
 */
export async function getRecentResults(
  client: SupabaseClient,
  limit = 3
): Promise<Match[]> {
  const { data, error } = await client
    .from("public_matches")
    .select(MATCH_FIELDS)
    .eq("status", "finished")
    .order("kicks_off_at", { ascending: false })
    .limit(limit);

  if (error) return [];
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
/**
 * Every match currently being played.
 *
 * Was limit(1), which meant that with three games kicking off together
 * you saw one and the other two were invisible. A match stays here
 * until a result is entered — no time window, because a fixture with no
 * score is exactly the thing worth still seeing.
 */
export async function getLiveMatches(
  client: SupabaseClient
): Promise<Match[]> {
  const { data, error } = await client
    .from("public_matches")
    .select(MATCH_FIELDS)
    .neq("status", "finished")
    .lte("kicks_off_at", new Date().toISOString())
    .order("kicks_off_at", { ascending: true })
    .limit(8);

  if (error) return [];
  return (data ?? []) as unknown as Match[];
}

/**
 * Every match sharing the next kickoff time.
 *
 * Four fields run simultaneously, so a "next match" is really a next
 * *slot* of four. Treating the slot as the unit is what keeps the
 * tournament block a fixed size: at most four live and four next, no
 * matter whether the weekend holds eight fixtures or eighty.
 */
export async function getNextSlot(
  client: SupabaseClient
): Promise<Match[]> {
  const { data, error } = await client
    .from("public_matches")
    .select(MATCH_FIELDS)
    .neq("status", "finished")
    .gt("kicks_off_at", new Date().toISOString())
    .order("kicks_off_at", { ascending: true })
    .limit(8);

  if (error) return [];

  const rows = (data ?? []) as unknown as Match[];
  if (rows.length === 0) return [];

  // Everything at the earliest time, and nothing from the slot after.
  const first = rows[0].kicks_off_at;
  return rows.filter((m) => m.kicks_off_at === first);
}

/** How many fixtures are still to come, for the link out. */
export async function countUpcoming(
  client: SupabaseClient
): Promise<number> {
  const { count, error } = await client
    .from("public_matches")
    .select("id", { count: "exact", head: true })
    .neq("status", "finished")
    .gt("kicks_off_at", new Date().toISOString());

  if (error) return 0;
  return count ?? 0;
}

/**
 * The soonest match that hasn't kicked off yet.
 *
 * Deliberately not filtered to status = 'scheduled'. A match locked
 * early — picks closed before kickoff, which happens — has status
 * 'locked' with a kickoff still in the future, so it satisfied neither
 * this nor getLiveMatches and disappeared from the block entirely while
 * still sitting on /matches. It belongs here; whether picks are open is
 * a separate question the interface already answers from is_open.
 */
export async function getNextMatch(
  client: SupabaseClient
): Promise<Match | null> {
  const { data, error } = await client
    .from("public_matches")
    .select(MATCH_FIELDS)
    .neq("status", "finished")
    .gt("kicks_off_at", new Date().toISOString())
    .order("kicks_off_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data as unknown as Match | null;
}

/**
 * The most recent finished match.
 *
 * Deliberately NOT limited to matches you predicted. The first version
 * was, which meant entering a result for a match you hadn't picked left
 * the block with nothing to show and no next match either — an empty
 * card. A result is news whether or not you had money on it; the points
 * line simply doesn't appear when there's no pick.
 *
 * Windowed to twelve hours so it stays news rather than history.
 */
export async function getLatestResult(
  client: SupabaseClient
): Promise<Match | null> {
  const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

  const { data, error } = await client
    .from("public_matches")
    .select(MATCH_FIELDS)
    .eq("status", "finished")
    .gte("kicks_off_at", since)
    .order("kicks_off_at", { ascending: false })
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

/**
 * Goes through an RPC rather than an upsert.
 *
 * An upsert compiles to INSERT ... ON CONFLICT DO UPDATE, and Postgres
 * requires UPDATE privilege on every column in the SET list at plan
 * time — including match_id and user_id, which a client has no business
 * changing. The RPC keeps the privilege in one place.
 *
 * userId is no longer needed: the function reads auth.uid(), so a
 * client can't write a prediction for someone else even by asking.
 */
export async function predict(
  client: SupabaseClient,
  matchId: string,
  home: number,
  away: number
): Promise<void> {
  const { error } = await client.rpc("make_prediction", {
    p_match: matchId,
    p_home: home,
    p_away: away,
  });

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

export type ChatOverride = "open" | "closed" | null;

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
  /** What the room's chat is doing right now. */
  chat_state: "waiting" | "open" | "closed" | "expired" | null;
  /** Set when a moderator has overridden the clock. */
  chat_override: ChatOverride;
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

/**
 * Reopens picks. Doesn't override kickoff — a match whose scheduled
 * time has passed stays closed until that time is moved, so nobody
 * picks a game they're already watching.
 */
export async function unlockMatch(
  client: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await client.rpc("unlock_match", { p_match: id });
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


export type DeleteImpact = {
  prediction_count: number;
  points_awarded: number;
  people_affected: number;
  has_room: boolean;
};

/** What deleting would cost, so it can be said before it happens. */
export async function getDeleteImpact(
  client: SupabaseClient,
  matchId: string
): Promise<DeleteImpact | null> {
  const { data, error } = await client.rpc("match_delete_impact", {
    p_match: matchId,
  });
  if (error) return null;
  const rows = (data ?? []) as DeleteImpact[];
  return rows[0] ?? null;
}

/**
 * Removes the match and every prediction on it. Admin only — this
 * changes other people's scores, which staff shouldn't be able to do
 * with one tap. Cancelling is the usual answer; this is for a match
 * entered by mistake.
 */
export async function deleteMatch(
  client: SupabaseClient,
  matchId: string
): Promise<void> {
  const { error } = await client.rpc("delete_match", { p_match: matchId });
  if (error) throw error;
}


/** Distinct people who called GOAL in the last 45 seconds. */
export async function getGoalBurst(
  client: SupabaseClient,
  roomId: string
): Promise<number> {
  const { data, error } = await client.rpc("goal_burst", { p_room: roomId });
  if (error) return 0;
  return (data as number) ?? 0;
}

export class TooSoonError extends Error {}

/**
 * Says that people reacted. Says nothing about the score — a crowd-voted
 * scoreline is gamed by whoever is loudest, drifts once people stop
 * bothering, and ends up contradicting the official result in front of
 * everyone.
 */
export async function callGoal(
  client: SupabaseClient,
  roomId: string
): Promise<number> {
  const { data, error } = await client.rpc("call_goal", { p_room: roomId });

  if (error) {
    if (error.message.includes("TOO_SOON")) {
      throw new TooSoonError("Give it a second.");
    }
    throw error;
  }
  return (data as number) ?? 1;
}


// ---- someone's record -------------------------------------------------

export type UserPick = {
  match_id: string;
  home_team: string;
  away_team: string;
  kicks_off_at: string;
  round: MatchRound;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  pick_home: number;
  pick_away: number;
  points: number | null;
  tier: string | null;
};

/**
 * What someone called, and how it went.
 *
 * Picks on matches that are still open come back only for the person
 * who made them — enforced in the function, not here, so a profile page
 * can't become a way to copy the leader before kickoff.
 */
export async function getUserPicks(
  client: SupabaseClient,
  userId: string
): Promise<UserPick[]> {
  const { data, error } = await client.rpc("user_predictions", {
    p_user: userId,
    p_limit: 60,
  });
  if (error) return [];
  return (data ?? []) as UserPick[];
}

export type PickSummary = {
  played: number;
  points: number;
  exact_count: number;
  rank: number | null;
};

export async function getPickSummary(
  client: SupabaseClient,
  userId: string
): Promise<PickSummary | null> {
  const { data, error } = await client.rpc("user_prediction_summary", {
    p_user: userId,
  });
  if (error) return null;
  const rows = (data ?? []) as PickSummary[];
  return rows[0] ?? null;
}


/**
 * Force a match room open or closed, or hand it back to the clock.
 *
 * Chat opens at kickoff and closes on a result on its own — this is the
 * contingency for the moderator standing there watching something go
 * wrong, not the mechanism. Passing null restores automatic behaviour
 * without anyone having to work out what that would be.
 */
export async function setRoomChat(
  client: SupabaseClient,
  matchId: string,
  state: ChatOverride
): Promise<string> {
  const { data, error } = await client.rpc("set_room_chat", {
    p_match: matchId,
    p_state: state,
  });
  if (error) throw error;
  return (data as string) ?? "";
}
