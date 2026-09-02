import type { SupabaseClient } from "@supabase/supabase-js";

/** One option, carrying its poll's details. See open_polls() in 0052. */
export type PollRow = {
  poll_id: string;
  question: string;
  sort_order: number;
  option_id: string;
  label: string;
  opt_order: number;
  votes: number;
  total_votes: number;
  is_mine: boolean;
  has_voted: boolean;
};

export type Poll = {
  id: string;
  question: string;
  totalVotes: number;
  hasVoted: boolean;
  options: {
    id: string;
    label: string;
    votes: number;
    isMine: boolean;
  }[];
};

/**
 * Open polls, grouped.
 *
 * The function returns one row per option so the whole list arrives in
 * a single call; grouping happens here rather than in SQL because the
 * shape the component wants is nested and the shape a query returns is
 * not.
 */
export async function getOpenPolls(client: SupabaseClient): Promise<Poll[]> {
  const { data, error } = await client.rpc("open_polls");
  if (error) return [];

  const rows = (data ?? []) as PollRow[];
  const byPoll = new Map<string, Poll>();

  for (const row of rows) {
    let poll = byPoll.get(row.poll_id);

    if (!poll) {
      poll = {
        id: row.poll_id,
        question: row.question,
        totalVotes: row.total_votes,
        hasVoted: row.has_voted,
        options: [],
      };
      byPoll.set(row.poll_id, poll);
    }

    poll.options.push({
      id: row.option_id,
      label: row.label,
      votes: row.votes,
      isMine: row.is_mine,
    });
  }

  return [...byPoll.values()];
}

export class PollClosedError extends Error {}

/** Casts or changes a vote. One per person per poll. */
export async function castVote(
  client: SupabaseClient,
  pollId: string,
  optionId: string
): Promise<void> {
  const { error } = await client.rpc("cast_vote", {
    p_poll: pollId,
    p_option: optionId,
  });

  if (error) {
    if (error.message.includes("POLL_CLOSED")) {
      throw new PollClosedError("That poll has closed.");
    }
    throw error;
  }
}
