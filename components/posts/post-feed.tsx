"use client";

import { useCallback, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getAuthorsFor,
  getLatestPosts,
  getUnansweredPosts,
  type Post,
} from "@/lib/queries/posts";
import type { Author } from "@/lib/queries/messages";
import type { Region } from "@/lib/queries/regions";
import { regionName } from "@/lib/queries/regions";
import { PostCard } from "@/components/posts/post-card";

const PAGE = 30;

/**
 * The feed with a way to reach older posts.
 *
 * Trending is deliberately not paginated: it's the top of a fixed
 * seven-day window, so "more" would mean less-trending, which isn't a
 * thing anyone asks for.
 */
export function PostFeed({
  initialPosts,
  initialAuthors,
  regions,
  region,
  tab,
}: {
  initialPosts: Post[];
  initialAuthors: Record<string, Author>;
  regions: Region[];
  region: string | null;
  tab: "latest" | "trending" | "needs";
}) {
  const supabase = useMemo(() => createClient(), []);

  const [posts, setPosts] = useState(initialPosts);
  const [authors, setAuthors] = useState(initialAuthors);
  // A short first page means there's nothing behind it.
  const [exhausted, setExhausted] = useState(initialPosts.length < PAGE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paginated = tab !== "trending";

  const loadMore = useCallback(async () => {
    if (loading || exhausted || posts.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const cursor = posts[posts.length - 1].created_at;
      const next =
        tab === "needs"
          ? await getUnansweredPosts(supabase, region, PAGE, cursor)
          : await getLatestPosts(supabase, region, PAGE, cursor);

      if (next.length < PAGE) setExhausted(true);
      if (next.length === 0) return;

      const moreAuthors = await getAuthorsFor(supabase, next);

      setPosts((current) => {
        // The cursor makes duplicates unlikely, but two posts sharing a
        // timestamp to the microsecond would slip one through.
        const seen = new Set(current.map((p) => p.id));
        return [...current, ...next.filter((p) => !seen.has(p.id))];
      });
      setAuthors((current) => ({ ...current, ...moreAuthors }));
    } catch {
      setError("Couldn't load more. Try again.");
    } finally {
      setLoading(false);
    }
  }, [supabase, posts, region, tab, loading, exhausted]);

  return (
    <>
      {tab === "needs" && (
        <p className="mb-3 text-sm text-stone-600">
          Nobody has answered these yet. If you know, say so.
        </p>
      )}

      <ul className="space-y-2">
        {posts.map((post) => (
          <li key={post.id}>
            <PostCard
              post={post}
              author={post.author_id ? authors[post.author_id] : undefined}
              regionLabel={
                post.region ? regionName(regions, post.region) : "All regions"
              }
            />
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="mt-3 text-center text-sm text-red-700">
          {error}
        </p>
      )}

      {paginated && !exhausted && (
        <button
          onClick={loadMore}
          disabled={loading}
          className="mt-4 w-full rounded-lg border border-stone-300 bg-stone-0 px-4 py-3 text-sm font-medium text-stone-700 disabled:opacity-40"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      )}

      {paginated && exhausted && posts.length >= PAGE && (
        <p className="mt-4 text-center text-sm text-stone-500">
          That&apos;s everything.
        </p>
      )}
    </>
  );
}
