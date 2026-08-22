"use client";

import { useState } from "react";

const MAX_RENDER_WIDTH = 280;

/**
 * Reserves the exact space an image will occupy before it loads, using
 * the dimensions stored at upload. Without this every photo shoves the
 * conversation around as it arrives.
 */
export function MessageImage({
  url,
  width,
  height,
  alt,
}: {
  url: string;
  width: number | null;
  height: number | null;
  alt: string;
}) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  // Fall back to 4:3 when dimensions are missing (messages sent before
  // 0009, or a measurement failure).
  const ratio = width && height ? height / width : 0.75;
  const renderWidth = Math.min(MAX_RENDER_WIDTH, width ?? MAX_RENDER_WIDTH);
  const renderHeight = Math.round(renderWidth * ratio);

  if (failed) {
    return (
      <p className="mt-1 text-sm text-stone-500">Image didn&apos;t load.</p>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 block overflow-hidden rounded-lg border border-stone-200 bg-stone-100"
        style={{ width: renderWidth, height: renderHeight }}
        aria-label="Open image"
      >
        {/* Plain img, not next/image: these are user uploads on a Supabase
            public URL, and routing them through the optimizer would cost
            transformations on every photo at an event. */}
        <img
          src={url}
          alt={alt}
          width={renderWidth}
          height={renderHeight}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
        >
          <img
            src={url}
            alt={alt}
            className="max-h-full max-w-full object-contain"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full bg-white/15 px-3 py-1.5 text-stone-0"
          >
            Close
          </button>
        </div>
      )}
    </>
  );
}
