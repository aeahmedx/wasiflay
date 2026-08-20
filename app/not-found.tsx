import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Not found" };

/**
 * Reached most often from a shared link to something that's since been
 * removed — so it says that, rather than "404", and points somewhere
 * useful instead of leaving people at a dead end.
 */
export default function NotFound() {
  return (
    <main className="min-h-dvh bg-stone-50 px-6 py-12">
      <div className="mx-auto flex max-w-sm flex-col items-center text-center">
        <div
          aria-hidden
          className="flex h-14 w-14 items-center justify-center rounded-lg bg-amber-400"
        >
          <svg width="36" height="36" viewBox="0 0 64 64" aria-hidden>
            <g
              transform="translate(32 32) rotate(-30) scale(0.84) translate(-32 -32)"
              fill="#FFFFFF"
              stroke="#2B1D07"
              strokeWidth="3"
              strokeLinejoin="round"
            >
              <path d="M29.5 7 h5 v50 h-5 z" />
              <path d="M34.5 13 h17 l6 5.5 -6 5.5 h-17 z" />
              <path d="M29.5 26 h-16 l-6 5.5 6 5.5 h16 z" />
              <path d="M34.5 39 h14 l6 5.5 -6 5.5 h-14 z" />
            </g>
          </svg>
        </div>

        <h1 className="mt-5 text-xl font-semibold text-stone-900">
          This isn&apos;t here
        </h1>
        <p className="mt-2 text-stone-600 leading-relaxed">
          It may have been deleted, or the link might be wrong. Try
          searching for it.
        </p>

        <div className="mt-6 flex w-full flex-col gap-2">
          <Link
            href="/search"
            className="rounded-lg bg-emerald-800 px-4 py-3 font-medium text-stone-0"
          >
            Search
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-stone-300 px-4 py-3 font-medium text-stone-700"
          >
            Go to the feed
          </Link>
        </div>
      </div>
    </main>
  );
}
