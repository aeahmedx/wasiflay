"use client";

/**
 * The share glyph is drawn rather than named, so people look for the
 * right button instead of reading the word and guessing.
 */
export function IOSInstallSteps() {
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-stone-600">
      <span>Tap</span>
      <span
        aria-label="Share"
        className="inline-flex items-center rounded border border-stone-300 px-1.5 py-0.5"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
          <path
            d="M12 3v12M12 3 8.5 6.5M12 3l3.5 3.5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span>at the bottom of Safari, then</span>
      <span className="font-medium text-stone-900">Add to Home Screen</span>
    </p>
  );
}
