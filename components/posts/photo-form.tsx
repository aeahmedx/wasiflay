"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { createPost, RateLimitError } from "@/lib/queries/posts";
import {
  compressImage,
  ImageDecodeError,
  ImageTooLargeError,
  measure,
  uploadPostImage,
} from "@/lib/queries/images";

/**
 * A photo, and nothing else.
 *
 * No title, no body, no category, no anonymity toggle. Every one of
 * those is a decision, and a decision between someone and a picture
 * from the sideline is why the picture ends up in WhatsApp instead.
 *
 * Pick, look, post. Three taps.
 */
export function PhotoForm({ userId }: { userId: string }) {
  const router = useRouter();

  const fileInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(file: File | undefined) {
    if (!file) return;

    setPreparing(true);
    setError(null);

    try {
      const blob = await compressImage(file);
      const dimensions = await measure(blob);

      // Replace rather than accumulate; one photo per post.
      if (preview) URL.revokeObjectURL(preview);

      setPhoto(blob);
      setSize(dimensions);
      setPreview(URL.createObjectURL(blob));
    } catch (e) {
      setError(
        e instanceof ImageTooLargeError
          ? "That photo is too big. Try one under 25MB."
          : e instanceof ImageDecodeError
          ? "Couldn't read that photo. Try a different one."
          : "Couldn't add that photo. Try again."
      );
    } finally {
      setPreparing(false);
      // Clear the input so picking the same file again still fires.
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function remove() {
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(null);
    setPreview(null);
    setSize(null);
  }

  async function post() {
    // Guards against a double tap as well as a missing file: saving is
    // set before the first await and never cleared on the success path,
    // because the page navigates away.
    if (!photo || saving || preparing) return;

    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      const imageUrl = await uploadPostImage(supabase, userId, photo);

      const created = await createPost(supabase, {
        author_id: userId,
        type: "photo",
        title: null,
        body: "",
        city: null,
        region: null,
        is_anonymous: false,
        image_url: imageUrl,
        image_width: size?.w ?? null,
        image_height: size?.h ?? null,
      });

      if (preview) URL.revokeObjectURL(preview);
      router.replace(`/posts/${created.id}`);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof RateLimitError
          ? "You're posting quickly. Give it a minute."
          : "Couldn't post that photo. Check your connection and try again."
      );
      setSaving(false);
    }
  }

  return (
    <div>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        onChange={(e) => void choose(e.target.files?.[0])}
        className="sr-only"
        id="photo-file"
      />

      {error && (
        <p
          role="alert"
          className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      {preview ? (
        <div className="overflow-hidden rounded-lg border border-stone-300 bg-stone-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="The photo you selected"
            className="block max-h-[60vh] w-full object-contain"
          />
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <span className="text-sm text-stone-600">Ready to post</span>
            <button
              type="button"
              onClick={remove}
              disabled={saving}
              className="text-sm font-medium text-red-700 disabled:opacity-40"
            >
              Choose another
            </button>
          </div>
        </div>
      ) : (
        <label
          htmlFor="photo-file"
          className="flex min-h-56 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-stone-300 bg-stone-0 px-4 py-10 text-center"
        >
          <span className="text-base font-medium text-stone-800">
            {preparing ? "Getting it ready…" : "Choose a photo"}
          </span>
          <span className="text-sm text-stone-500">
            No caption needed. Just the picture.
          </span>
        </label>
      )}

      <button
        type="button"
        onClick={() => void post()}
        disabled={!photo || saving || preparing}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-800 px-4 py-3.5 font-semibold text-stone-0 disabled:opacity-40"
      >
        {saving && (
          <span
            aria-hidden
            className="h-4 w-4 animate-spin rounded-full border-2 border-stone-0 border-t-transparent"
          />
        )}
        {saving ? "Posting…" : "Post photo"}
      </button>

      <Link
        href="/create"
        className="mt-3 block text-center text-sm text-stone-600 underline underline-offset-4"
      >
        Write a post instead
      </Link>
    </div>
  );
}
