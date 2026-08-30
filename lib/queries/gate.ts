import type { SupabaseClient } from "@supabase/supabase-js";

export type GateState = {
  is_open: boolean;
  opens_at: string | null;
  forced: boolean;
  match_id: string | null;
  home_team: string | null;
  away_team: string | null;
  kicks_off_at: string | null;
  /** False while the fixture exists but its teams are still TBD. */
  teams_announced: boolean;
  prediction_count: number;
  my_home: number | null;
  my_away: number | null;
  /** Names only — never what they called. Picks stay hidden until
   *  kickoff, and the gate is not an exception. Empty until enough
   *  people have picked to read as a group. */
  recent_names: string[];
  /** Where you came in the order of picks. Null if you haven't. */
  my_position: number | null;
};

/** Nothing configured means no gate — which is the app's normal life. */
const OPEN: GateState = {
  is_open: true,
  opens_at: null,
  forced: false,
  match_id: null,
  home_team: null,
  away_team: null,
  kicks_off_at: null,
  teams_announced: false,
  prediction_count: 0,
  my_home: null,
  my_away: null,
  recent_names: [],
  my_position: null,
};

/**
 * Everything the gate needs, in one call.
 *
 * Fails open on purpose. A gate that shuts the whole app because a
 * query hiccuped is far worse than one that lets people in early — the
 * failure mode has to be "the app works" rather than "nobody can reach
 * anything".
 */
export async function getGateState(
  client: SupabaseClient
): Promise<GateState> {
  const { data, error } = await client.rpc("gate_state");
  if (error) return OPEN;

  const rows = (data ?? []) as GateState[];
  return rows[0] ?? OPEN;
}

export async function setGate(
  client: SupabaseClient,
  opensAtIso: string | null,
  forced: boolean
): Promise<boolean> {
  const { data, error } = await client.rpc("set_gate", {
    p_opens_at: opensAtIso,
    p_forced: forced,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function setFeaturedMatch(
  client: SupabaseClient,
  matchId: string | null
): Promise<void> {
  const { error } = await client.rpc("set_featured_match", {
    p_match: matchId,
  });
  if (error) throw error;
}


export type GateMatch = {
  id: string;
  home_team: string;
  away_team: string;
  kicks_off_at: string;
  round: string;
  group_label: string | null;
  field_label: string | null;
  teams_announced: boolean;
  prediction_count: number;
  my_home: number | null;
  my_away: number | null;
};

/**
 * The fixtures on the gate, soonest first.
 *
 * How many is a decision, not a schedule — someone who picked two on
 * Monday finds four on Wednesday, and that's the only honest reason a
 * countdown page has to bring anyone back.
 */
export async function getGateMatches(
  client: SupabaseClient
): Promise<GateMatch[]> {
  const { data, error } = await client.rpc("gate_matches");
  if (error) return [];
  return (data ?? []) as GateMatch[];
}

export type GateReveal = { revealed: number; available: number };

export async function getGateReveal(
  client: SupabaseClient
): Promise<GateReveal> {
  const { data, error } = await client.rpc("gate_reveal");
  if (error) return { revealed: 1, available: 0 };
  const rows = (data ?? []) as GateReveal[];
  return rows[0] ?? { revealed: 1, available: 0 };
}

export async function setGateReveal(
  client: SupabaseClient,
  count: number
): Promise<number> {
  const { data, error } = await client.rpc("set_gate_reveal", {
    p_count: count,
  });
  if (error) throw error;
  return (data as number) ?? count;
}
