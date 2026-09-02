"use client";

import { useRef, useState } from "react";
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
import { Toggle } from "@/components/ui/toggle";
import { ContentNotice } from "@/components/content-notice";
import { checkContent, contentErrorMessage } from "@/lib/content-safety";
import {
  compressImage,
  ImageDecodeError,
  ImageTooLargeError,
  measure,
  uploadPostImage,
} from "@/lib/queries/images";
import type { Region } from "@/lib/queries/regions";

const TITLE_PLACEHOLDER: Record<PostType, string> = {
  question: "What do you want to ask?",
  recommendation: "What do you want to share?",
  announcement: "What's happening?",
};

export function CreatePostForm({
  userId,
  regions,
  initialTitle = "",
  eventId = null,
  initialType,
}: {
  userId: string;
  regions: Region[];
  /**
   * SPEC 4.3 — the zero-result search screen links here with ?q=.
   * Read on the server and passed down, rather than pulled out of
   * window.location in an effect: setting state synchronously inside an
   * effect causes a second render pass before paint, and the prefilled
   * title would visibly pop in.
   */
  initialTitle?: string;
  /** Set when the question came from an event page, so the answer lands
   *  back on that event rather than scattering into the general feed. */
  eventId?: string | null;
  /** Set when the link knows what kind of post this is — a result brag
   *  opens as an announcement rather than as a question. */
  initialType?: PostType;
}) {
  const router = useRouter();

  const [type, setType] = useState<PostType>(initialType ?? "question");
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState("");
  // Defaults to every region on purpose. Early on, a post scattered into
  // one of 24 regional feeds reads as an empty product everywhere; a
  // region-less post shows up in all of them. People narrow it when the
  // question is genuinely local.
  const [region, setRegion] = useState<string>("__all__");
  const [anonymous, setAnonymous] = useState(false);
  const prefilled = initialTitle.length > 0;

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * The photo, held locally until the post is submitted.
   *
   * Compressed on selection rather than on submit so the wait happens
   * while someone is still writing, not after they have tapped Post.
   * A preview URL is kept alongside so the file never has to be read
   * twice.
   */
  const fileInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoSize, setPhotoSize] = useState<{ w: number; h: number } | null>(
    null
  );
  const [preparing, setPreparing] = useState(false);

  async function choosePhoto(file: File | undefined) {
    if (!file) return;

    setPreparing(true);
    setError(null);

    try {
      const blob = await compressImage(file);
      const size = await measure(blob);

      // Replace rather than accumulate; only one photo per post.
      if (photoPreview) URL.revokeObjectURL(photoPreview);

      setPhoto(blob);
      setPhotoSize(size);
      setPhotoPreview(URL.createObjectURL(blob));
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

  function removePhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(null);
    setPhotoPreview(null);
    setPhotoSize(null);
  }

  const trimmedTitle = title.trim();
  const combined = `${title} ${body}`;
  // Blocked outright — nothing else here stops a post.
  const blocked = checkContent(combined).hasCardNumber;
  const valid =
    trimmedTitle.length >= 5 &&
    trimmedTitle.length <= 200 &&
    !blocked &&
    !preparing;

  async function submit() {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();

      // Uploaded here rather than on selection so an abandoned draft
      // never leaves an orphaned file in storage.
      let imageUrl: string | null = null;
      if (photo) {
        imageUrl = await uploadPostImage(supabase, userId, photo);
      }

      const created = await createPost(supabase, {
        author_id: userId,
        type,
        title: trimmedTitle,
        body: body.trim(),
        city: null,
        region: region === "__all__" ? null : region,
        is_anonymous: anonymous,
        event_id: eventId,
        image_url: imageUrl,
        image_width: photoSize?.w ?? null,
        image_height: photoSize?.h ?? null,
      });
      router.replace(safeNext(`/posts/${created.id}`));
      router.refresh();
    } catch (e) {
      const raw = e instanceof Error ? e.message : "";
      setError(
        e instanceof RateLimitError
          ? "You're posting quickly. Wait a moment and try again."
          : contentErrorMessage(raw) ??
            (raw ? `Couldn't post: ${raw}` : "Couldn't post. Check your connection and try again.")
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
            {prefilled && (
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
              makes immigration, legal and money questions askable.

              A Toggle rather than a checkbox: on iOS a checkbox steals
              focus from the body field and Safari drops the keyboard. */}
          {/* Photo. Sits above the anonymity toggle because it is part
              of writing the post, and the toggle is the last decision. */}
          <div>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              onChange={(e) => void choosePhoto(e.target.files?.[0])}
              className="sr-only"
              id="post-photo"
            />

            {photoPreview ? (
              <div className="overflow-hidden rounded-lg border border-stone-300 bg-stone-0">
                {/* Plain img, not next/image: the source is a local
                    object URL that the optimiser cannot fetch. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoPreview}
                  alt="Selected photo"
                  className="block max-h-72 w-full object-contain"
                />
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-sm text-stone-600">Photo added</span>
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="text-sm font-medium text-red-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <label
                htmlFor="post-photo"
                className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-stone-300 bg-stone-0 px-4 py-4 text-sm font-medium text-stone-700"
              >
                {preparing ? "Adding photo…" : "Add a photo"}
              </label>
            )}
          </div>

          <ContentNotice text={combined} />

          <Toggle
            checked={anonymous}
            onChangeAction={setAnonymous}
            label="Post anonymously"
            description="Your name won't be shown on this post."
          />
        </div>

        <button
          onClick={submit}
          disabled={!valid || saving}
          className="mt-6 w-full rounded-lg bg-emerald-800 px-4 py-3.5 font-medium text-stone-0 disabled:opacity-40"
        >
          {saving ? "Posting…" : preparing ? "Adding photo…" : "Post"}
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
