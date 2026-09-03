"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * What the + button opens.
 *
 * Two doors rather than one form. Posting a picture and writing a
 * question are different jobs, and putting a photo behind a title, a
 * body and a category is why pictures end up somewhere else.
 *
 * A sheet rather than a page: it opens over what you were looking at
 * and closes back onto it, so choosing wrong costs a tap instead of a
 * navigation.
 */
export function CreateChoice() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Add something"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex h-[4.5rem] w-full flex-col items-center justify-center gap-1"
      >
        {/* Fixed brown, not a token: emerald-800 becomes yellow in dark
            mode, and the bar behind this is yellow in both. */}
        <span
          style={{ backgroundColor: "#2b1d07", color: "#f5a623" }}
          className="flex h-11 w-11 items-center justify-center rounded-full shadow-sm"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add something"
          className="fixed inset-0 z-50 flex flex-col justify-end"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-stone-900/40"
          />

          <div
            className="relative mx-auto w-full max-w-md rounded-t-2xl bg-stone-0 px-4 pt-4"
            style={{
              paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
            }}
          >
            <Link
              href="/create/photo"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg border border-stone-200 px-4 py-3.5"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stone-100">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-stone-700"
                  fill="none"
                  aria-hidden
                >
                  <rect
                    x="3"
                    y="5"
                    width="18"
                    height="14"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />
                  <circle
                    cx="8.5"
                    cy="10"
                    r="1.6"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />
                  <path
                    d="m4 17 5-4 4 3 3-2 4 3"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block font-medium text-stone-900">Photo</span>
                <span className="block text-sm text-stone-600">
                  Just the picture. Nothing to fill in.
                </span>
              </span>
            </Link>

            <Link
              href="/create"
              onClick={() => setOpen(false)}
              className="mt-2 flex items-center gap-3 rounded-lg border border-stone-200 px-4 py-3.5"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stone-100">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-stone-700"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M5 4h9l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M8 12h8M8 16h5"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block font-medium text-stone-900">Post</span>
                <span className="block text-sm text-stone-600">
                  Ask a question, share something, recommend someone.
                </span>
              </span>
            </Link>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-3 w-full py-2.5 text-sm font-medium text-stone-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
