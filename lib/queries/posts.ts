import type { SupabaseClient } from "@supabase/supabase-js";
import type { Author } from "@/lib/queries/messages";

export type PostType = "question" | "recommendation" | "announcement";

export const POST_TYPES: { value: PostType; label: string; hint: string }[] = [
  { value: "question", label: "Question", hint: "Ask the community" },
  {
    value: "recommendation",
    label: "Recommendation",
    hint: "Share a good experience",
  },
  {
    value: "announcement",
    label: "Announcement",
    hint: "Tell people about something",
  },
];

export type Post = {
  id: string;
  author_id: string;
  type: PostType;
  title: string;
  body: string;
  city: string | null;
  is_anonymous: boolean;
  answer_count: number;
  helpful_count: number;
  created_at: string;
};

export type Answer = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  is_anonymous: boolean;
  helpful_count: number;
  created_at: string;
};

const POST_FIELDS =
  "id, author_id, type, title, body, city, is_anonymous, answer_count, helpful_count, created_at";
const ANSWER_FIELDS =
  "id, post_id, author_id, body, is_anonymous, helpful_count, created_at";

export class RateLimitError extends Error {
  constructor() {
    super("RATE_LIMIT");
    this.name = "RateLimitError";
  }
}

function isRateLimit(error: { message?: string } | null): boolean {
  return Boolean(error?.message?.includes("RATE_LIMIT"));
}

/** SPEC 3.3 — Latest tab. */
export async function getLatestPosts(
  client: SupabaseClient,
  city: string | null,
  limit = 30
): Promise<Post[]> {
  let query = client
    .from("posts")
    .select(POST_FIELDS)
    .eq("is_removed", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (city) query = query.eq("city", city);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Post[];
}

/**
 * SPEC 3.3 — Trending tab. Activity over the last 7 days.
 * Sorted client-side on answer_count + helpful_count: the set is small
 * and Postgres can't order by a computed sum without a view.
 */
export async function getTrendingPosts(
  client: SupabaseClient,
  city: string | null,
  limit = 30
): Promise<Post[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let query = client
    .from("posts")
    .select(POST_FIELDS)
    .eq("is_removed", false)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(120);

  if (city) query = query.eq("city", city);

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as Post[])
    .sort(
      (a, b) =>
        b.answer_count + b.helpful_count - (a.answer_count + a.helpful_count)
    )
    .slice(0, limit);
}

export async function getPost(
  client: SupabaseClient,
  id: string
): Promise<Post | null> {
  const { data, error } = await client
    .from("posts")
    .select(POST_FIELDS)
    .eq("id", id)
    .eq("is_removed", false)
    .maybeSingle();

  if (error) throw error;
  return data as Post | null;
}

/** SPEC 5.2 — most helpful first, then oldest. */
export async function getAnswers(
  client: SupabaseClient,
  postId: string
): Promise<Answer[]> {
  const { data, error } = await client
    .from("answers")
    .select(ANSWER_FIELDS)
    .eq("post_id", postId)
    .eq("is_removed", false)
    .order("helpful_count", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Answer[];
}

export async function createPost(
  client: SupabaseClient,
  input: {
    author_id: string;
    type: PostType;
    title: string;
    body: string;
    city: string | null;
    is_anonymous: boolean;
  }
): Promise<Post> {
  const { data, error } = await client
    .from("posts")
    .insert(input)
    .select(POST_FIELDS)
    .single();

  if (error) {
    if (isRateLimit(error)) throw new RateLimitError();
    throw error;
  }
  return data as Post;
}

export async function createAnswer(
  client: SupabaseClient,
  input: {
    post_id: string;
    author_id: string;
    body: string;
    is_anonymous: boolean;
  }
): Promise<Answer> {
  const { data, error } = await client
    .from("answers")
    .insert(input)
    .select(ANSWER_FIELDS)
    .single();

  if (error) {
    if (isRateLimit(error)) throw new RateLimitError();
    throw error;
  }
  return data as Answer;
}

/**
 * Authors for a set of posts or answers. Anonymous items are excluded —
 * their author_id must never leave the server-rendered boundary.
 */
export async function getAuthorsFor(
  client: SupabaseClient,
  items: { author_id: string; is_anonymous: boolean }[]
): Promise<Record<string, Author>> {
  const ids = Array.from(
    new Set(items.filter((i) => !i.is_anonymous).map((i) => i.author_id))
  );
  if (ids.length === 0) return {};

  const { data, error } = await client
    .from("public_profiles")
    .select("id, display_name, country_flag")
    .in("id", ids);

  if (error) throw error;

  const map: Record<string, Author> = {};
  ((data ?? []) as Author[]).forEach((a) => (map[a.id] = a));
  return map;
}

// ---- helpful votes (SPEC 5.2) ---------------------------------------

export type VoteTarget = "post" | "answer";

export async function getMyVotes(
  client: SupabaseClient,
  voterId: string,
  target: VoteTarget,
  ids: string[]
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();

  const { data, error } = await client
    .from("votes")
    .select("target_id")
    .eq("voter_id", voterId)
    .eq("target_type", target)
    .in("target_id", ids);

  if (error) throw error;
  return new Set(((data ?? []) as { target_id: string }[]).map((v) => v.target_id));
}

export async function addVote(
  client: SupabaseClient,
  voterId: string,
  target: VoteTarget,
  targetId: string
) {
  const { error } = await client.from("votes").insert({
    voter_id: voterId,
    target_type: target,
    target_id: targetId,
  });
  // 23505 = already voted. Idempotent by design; not an error worth raising.
  if (error && error.code !== "23505") throw error;
}

export async function removeVote(
  client: SupabaseClient,
  voterId: string,
  target: VoteTarget,
  targetId: string
) {
  const { error } = await client
    .from("votes")
    .delete()
    .eq("voter_id", voterId)
    .eq("target_type", target)
    .eq("target_id", targetId);

  if (error) throw error;
}
