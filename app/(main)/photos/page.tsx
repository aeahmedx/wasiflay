import type { Metadata } from "next";
import Link from "next/link";
import { OG_IMAGE } from "@/lib/og";
import { createClient } from "@/lib/supabase/server";
import { getPhotoPosts, type Post } from "@/lib/queries/posts";
import { LiveRefresh } from "@/components/live-refresh";

export const metadata: Metadata = {
  title: "Photos",
  description: "Every moment from the weekend, in one place.",
  openGraph: {
    type: "website",
    url: "https://www.wasiflay.com/photos",
    siteName: "Wasif Lay",
    images: [OG_IMAGE],
    title: "Wasif Lay · Photos",
    description: "Every moment from the weekend, in one place.",
  },
};

/**
 * The wall.
 *
 * Pictures only — no titles, no bodies, no counts. Somewhere to scroll
 * and see the weekend, which is a different thing from reading it. Tap
 * any tile for the post it belongs to.
 */
export default async function PhotosPage() {
  const supabase = await createClient();

  let photos: Post[] = [];
  let loadFailed = false;

  try {
    photos = await getPhotoPosts(supabase, 90);
  } catch {
    loadFailed = true;
  }

  return (
    <main className="min-h-dvh bg-stone-50 pb-safe-page">
      <LiveRefresh watch={[{ table: "posts" }]} />

      <header className="px-4 pb-3 pt-6">
        <div className="mx-auto max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Photos
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Every moment from the weekend.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-md px-1">
        {loadFailed && (
          <p
            role="status"
            className="mx-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3.5 text-sm text-stone-700"
          >
            Couldn&apos;t load the photos. Usually a bad moment of signal —
            try again in a few seconds.
          </p>
        )}

        {!loadFailed && photos.length === 0 && (
          <div className="mx-3 rounded-lg border border-stone-200 bg-stone-0 px-4 py-10 text-center">
            <p className="font-medium text-stone-900">No photos yet</p>
            <p className="mt-1 text-sm leading-relaxed text-stone-600">
              Be the first. One tap, one picture, nothing else to fill in.
            </p>
            <Link
              href="/create/photo"
              className="mt-3 inline-block rounded-lg bg-emerald-800 px-4 py-2.5 font-semibold text-stone-0"
            >
              Add a photo
            </Link>
          </div>
        )}

        {photos.length > 0 && (
          <ul className="grid grid-cols-3 gap-1">
            {photos.map((photo) => (
              <li key={photo.id}>
                <Link
                  href={`/posts/${photo.id}`}
                  className="block aspect-square overflow-hidden bg-stone-100"
                >
                  {/*
                    A plain img, matching the feed and the rooms. The
                    Supabase storage domain is not in next.config's
                    remotePatterns, so next/image would fail on exactly
                    these URLs.
                  */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.image_url ?? ""}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
