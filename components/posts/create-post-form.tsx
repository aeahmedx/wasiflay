"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  createPost,
  POST_TYPES,
  RateLimitError,
  type PostType,
} from "@/lib/queries/posts";
import { safeNext } from "@/lib/safe-next";
import { BackLink } from "@/components/back-link";
import type { Region } from "@/lib/queries/regions";

const TITLE_PLACEHOLDER: Record<PostType, string> = {
  question: "What do you want to ask?",
  recommendation: "What do you want to share?",
  announcement: "What's happening?",
};

export function CreatePostForm({
  userId,
  regions,
}: {
  userId: string;
  regions: Region[];
}) {
  const router = useRouter();

  const [type, setType] = useState<PostType>("question");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  // Defaults to every region on purpose. Early on, a post scattered into
  // one of 24 regional feeds reads as an empty product everywhere; a
  // region-less post shows up in all of them. People narrow it when the
  // question is genuinely local.
  const [region, setRegion] = useState<string>("__all__");
  const [anonymous, setAnonymous] = useState(false);
  const [prefillType, setPrefillType] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // SPEC 4.3 — the zero-result search screen links here with ?q=
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) {
      setTitle(q);
      setPrefillType(true);
    }
  }, []);

  const trimmedTitle = title.trim();
  const valid = trimmedTitle.length >= 5 && trimmedTitle.length <= 200;

  async function submit() {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      const created = await createPost(supabase, {
        author_id: userId,
        type,
        title: trimmedTitle,
        body: body.trim(),
        city: null,
        region: region === "__all__" ? null : region,
        is_anonymous: anonymous,
      });
      router.replace(safeNext(`/posts/${created.id}`));
      router.refresh();
    } catch (e) {
      setError(
        e instanceof RateLimitError
          ? "You're posting quickly. Wait a moment and try again."
          : "Couldn't post. Check your connection and try again."
      );
      setSaving(false);
    }
  }

  return (
    <main className="min-h-dvh bg-stone-50 px-4 py-6">
      <div className="max-w-md mx-auto">
        {/* router.back(), so it returns wherever you came from — the feed,
            a search, a zero-result screen. Submitting uses replace, so
            the form never sits in history behind its own result. */}
        <BackLink />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900 mb-6">
          New post
        </h1>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        <fieldset className="mb-5">
          <legend className="text-sm font-medium text-stone-800 mb-2">
            Type
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {POST_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                aria-pressed={type === t.value}
                className={`rounded-lg border px-2 py-2.5 text-sm transition ${
                  type === t.value
                    ? "border-emerald-800 bg-emerald-50 text-emerald-900 font-medium"
                    : "border-stone-300 bg-stone-0 text-stone-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-stone-500">
            {POST_TYPES.find((t) => t.value === type)?.hint}
          </p>
        </fieldset>

        <div className="space-y-5">
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-stone-800 mb-1.5"
            >
              Title
            </label>
            <input
              id="title"
              dir="auto"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder={TITLE_PLACEHOLDER[type]}
              className="w-full rounded-lg border border-stone-300 bg-stone-0 px-3.5 py-3 text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-800"
            />
            {prefillType && (
              <p className="mt-1.5 text-xs text-stone-500">
                Filled in from your search. Edit it to read like a question.
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="body"
              className="block text-sm font-medium text-stone-800 mb-1.5"
            >
              Details{" "}
              <span className="font-normal text-stone-500">(optional)</span>
            </label>
            <textarea
              id="body"
              dir="auto"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              maxLength={10000}
              className="w-full rounded-lg border border-stone-300 bg-stone-0 px-3.5 py-3 text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-800"
            />
          </div>

          <div>
            <label
              htmlFor="region"
              className="block text-sm font-medium text-stone-800 mb-1.5"
            >
              Region
            </label>
            <select
              id="region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full rounded-lg border border-stone-300 bg-stone-0 px-3.5 py-3 text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-800"
            >
              <option value="__all__">All regions</option>
              {regions.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.name}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-stone-500">
              Everybody sees this. Pick a region if it&apos;s only useful
              to people there.
            </p>
          </div>

          {/* SPEC 5.1 — anonymous is prominent, not buried. It is what
              makes immigration, legal and money questions askable. */}
          <label className="flex items-start gap-3 rounded-lg border border-stone-300 bg-stone-0 px-3.5 py-3 cursor-pointer">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-emerald-800"
            />
            <span>
              <span className="block font-medium text-stone-900">
                Post anonymously
              </span>
              <span className="block text-sm text-stone-600">
                Your name won&apos;t be shown on this post.
              </span>
            </span>
          </label>
        </div>

        <button
          onClick={submit}
          disabled={!valid || saving}
          className="mt-6 w-full rounded-lg bg-emerald-800 px-4 py-3.5 font-medium text-stone-0 disabled:opacity-40"
        >
          {saving ? "Posting…" : "Post"}
        </button>

        {title.length > 0 && !valid && (
          <p className="mt-2 text-sm text-stone-600">
            Titles need at least 5 characters.
          </p>
        )}
      </div>
    </main>
  );
}
