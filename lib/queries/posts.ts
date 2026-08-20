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
  author_id: string | null; // null when anonymous and not yours
  type: PostType;
  title: string;
  body: string;
  city: string | null;
  region: string | null; // null = all regions
  is_anonymous: boolean;
  answer_count: number;
  helpful_count: number;
  event_id: string | null;
  created_at: string;
};

export type Answer = {
  id: string;
  post_id: string;
  author_id: string | null; // null when anonymous and not yours
  body: string;
  is_anonymous: boolean;
  helpful_count: number;
  created_at: string;
};

const POST_FIELDS =
  "id, author_id, type, title, body, city, region, is_anonymous, answer_count, helpful_count, event_id, created_at";
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
  region: string | null,
  limit = 30,
  /** created_at of the last post you already have. Cursor rather than
   *  offset: posts arriving while someone reads would shift an offset
   *  window and duplicate or skip rows. */
  before?: string
): Promise<Post[]> {
  let query = client
    .from("public_posts")
    .select(POST_FIELDS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (before) query = query.lt("created_at", before);

  // A null-region post belongs to every feed.
  if (region) query = query.or(`region.eq.${region},region.is.null`);

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
  region: string | null,
  limit = 30
): Promise<Post[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let query = client
    .from("public_posts")
    .select(POST_FIELDS)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(120);

  // A null-region post belongs to every feed.
  if (region) query = query.or(`region.eq.${region},region.is.null`);

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
    .from("public_posts")
    .select(POST_FIELDS)
    .eq("id", id)
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
    .from("public_answers")
    .select(ANSWER_FIELDS)
    .eq("post_id", postId)
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
    region: string | null;
    is_anonymous: boolean;
    event_id?: string | null;
  }
): Promise<{ id: string }> {
  // Only `id` is read back. Migration 0004 revoked SELECT on author_id for
  // authenticated, so selecting the full row here fails with permission
  // denied even though the insert itself succeeds.
  const { data, error } = await client
    .from("posts")
    .insert(input)
    .select("id")
    .single();

  if (error) {
    if (isRateLimit(error)) throw new RateLimitError();
    throw error;
  }
  return data as { id: string };
}

export async function createAnswer(
  client: SupabaseClient,
  input: {
    post_id: string;
    author_id: string;
    body: string;
    is_anonymous: boolean;
  }
): Promise<void> {
  // No read-back: see the note in createPost. The page refreshes and picks
  // the answer up through public_answers.
  const { error } = await client.from("answers").insert(input);

  if (error) {
    if (isRateLimit(error)) throw new RateLimitError();
    throw error;
  }
}

/**
 * Authors for a set of posts or answers. Anonymous items are excluded —
 * their author_id must never leave the server-rendered boundary.
 */
export async function getAuthorsFor(
  client: SupabaseClient,
  items: { author_id: string | null; is_anonymous: boolean }[]
): Promise<Record<string, Author>> {
  const ids = Array.from(
    new Set(
      items
        .filter((i) => !i.is_anonymous && i.author_id)
        .map((i) => i.author_id as string)
    )
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


// ---------------------------------------------------------------------
// Editing (own content only — enforced by RLS + column grants)
// ---------------------------------------------------------------------

export async function updatePost(
  client: SupabaseClient,
  id: string,
  input: {
    title: string;
    body: string;
    region: string | null;
    is_anonymous: boolean;
  }
): Promise<void> {
  const { error } = await client.from("posts").update(input).eq("id", id);
  if (error) throw error;
}

export async function updateAnswer(
  client: SupabaseClient,
  id: string,
  body: string
): Promise<void> {
  const { error } = await client.from("answers").update({ body }).eq("id", id);
  if (error) throw error;
}


// ---------------------------------------------------------------------
// Needs an answer
//
// Questions with zero answers. Not "zero helpful answers" — a question
// with one mediocre answer still reads as answered to anyone arriving,
// and a helpful-vote being withdrawn would silently push it back into
// the queue, which nobody would understand.
//
// Recommendations and announcements are excluded: neither is waiting on
// anything.
// ---------------------------------------------------------------------

export async function getUnansweredPosts(
  client: SupabaseClient,
  region: string | null,
  limit = 30,
  before?: string
): Promise<Post[]> {
  let query = client
    .from("public_posts")
    .select(POST_FIELDS)
    .eq("type", "question")
    .eq("answer_count", 0)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (before) query = query.lt("created_at", before);

  // A region-less post belongs to every feed.
  if (region) query = query.or(`region.eq.${region},region.is.null`);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Post[];
}

/** Count only — head request, no rows transferred. */
export async function getUnansweredCount(
  client: SupabaseClient,
  region: string | null
): Promise<number> {
  let query = client
    .from("public_posts")
    .select("id", { count: "exact", head: true })
    .eq("type", "question")
    .eq("answer_count", 0);

  if (region) query = query.or(`region.eq.${region},region.is.null`);

  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}
