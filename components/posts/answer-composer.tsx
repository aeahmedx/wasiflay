"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { createAnswer, RateLimitError } from "@/lib/queries/posts";

/**
 * SPEC 5.3 — pinned to the bottom, always visible. Answering is the
 * behaviour the entire product depends on, so it gets the lowest-friction
 * placement on the screen.
 */
export function AnswerComposer({
  postId,
  userId,
  isBanned = false,
}: {
  postId: string;
  userId: string | null;
  isBanned?: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const trimmed = body.trim();
    if (!trimmed || !userId || saving) return;

    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      await createAnswer(supabase, {
        post_id: postId,
        author_id: userId,
        body: trimmed,
        is_anonymous: anonymous,
      });
      setBody("");
      setAnonymous(false);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof RateLimitError
          ? "Slow down a second."
          : "Couldn't post your answer. Try again."
      );
    } finally {
      setSaving(false);
    }
  }

  if (userId && isBanned) {
    return (
      <div className="sticky bottom-0 border-t border-stone-200 bg-stone-0 px-4 py-3">
        <p className="text-center text-sm text-stone-600">
          Your account is suspended, so you can&apos;t answer right now. You
          can still read everything.
        </p>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="sticky bottom-0 border-t border-stone-200 bg-stone-0 px-4 py-3">
        <Link
          href={`/signup?next=${encodeURIComponent(`/posts/${postId}`)}`}
          className="block text-center rounded-lg bg-emerald-800 px-4 py-2.5 font-medium text-stone-0"
        >
          Sign in to answer
        </Link>
      </div>
    );
  }

  return (
    <div className="sticky bottom-0 border-t border-stone-200 bg-stone-0 px-4 py-3">
      {error && (
        <p role="alert" className="mb-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        dir="auto"
        maxLength={10000}
        placeholder="Share what you know"
        className="w-full resize-none rounded-lg border border-stone-300 px-3.5 py-2.5 text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-800"
      />

      <div className="mt-2 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            className="w-4 h-4 accent-emerald-800"
          />
          Anonymously
        </label>

        <button
          onClick={submit}
          disabled={!body.trim() || saving}
          className="rounded-lg bg-emerald-800 px-4 py-2 font-medium text-stone-0 disabled:opacity-40"
        >
          {saving ? "Posting…" : "Answer"}
        </button>
      </div>
    </div>
  );
}
