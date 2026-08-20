"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { Toggle } from "@/components/ui/toggle";
import { createClient } from "@/lib/supabase/client";
import { updatePost, type Post } from "@/lib/queries/posts";
import type { Region } from "@/lib/queries/regions";

export function PostEditForm({
  post,
  regions,
}: {
  post: Post;
  regions: Region[];
}) {
  const router = useRouter();

  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const [region, setRegion] = useState<string>(post.region ?? "__all__");
  const [anonymous, setAnonymous] = useState(post.is_anonymous);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = title.trim();
  const valid = trimmed.length >= 5 && trimmed.length <= 200;

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      await updatePost(supabase, post.id, {
        title: trimmed,
        body: body.trim(),
        region: region === "__all__" ? null : region,
        is_anonymous: anonymous,
      });
      router.replace(`/posts/${post.id}`);
      router.refresh();
    } catch {
      setError("Couldn't save. Check your connection and try again.");
      setSaving(false);
    }
  }

  return (
    <main className="min-h-dvh bg-stone-50 px-4 py-6">
      <div className="max-w-md mx-auto">
        {/* BackLink, not a Link: a Link pushes a new history entry, so
            post -> edit -> post left Back on the post pointing at edit,
            and the two screens trapped each other. */}
        <BackLink fallback={`/posts/${post.id}`} />

        <h1 className="mt-4 mb-6 text-2xl font-semibold tracking-tight text-stone-900">
          Edit post
        </h1>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </div>
        )}

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
              className="w-full rounded-lg border border-stone-300 bg-stone-0 px-3.5 py-3 text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-800"
            />
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
          </div>

          <Toggle
            checked={anonymous}
            onChangeAction={setAnonymous}
            label="Post anonymously"
            description="Your name won't be shown on this post."
          />
        </div>

        <button
          onClick={save}
          disabled={!valid || saving}
          className="mt-6 w-full rounded-lg bg-emerald-800 px-4 py-3.5 font-medium text-stone-0 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </main>
  );
}
