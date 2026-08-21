"use client";

import { useState } from "react";

/**
 * Share a post, an answer, or an event.
 *
 * Every share is a way in for someone who isn't here yet, and the link
 * already previews properly in WhatsApp — so this is close to free
 * acquisition. It stays a plain text control rather than a coloured
 * button so it reads as an affordance, not a campaign.
 *
 * The native sheet is used where it exists, which on a phone is
 * everywhere and is what people expect. Desktop falls back to copying,
 * with a moment of confirmation so the tap doesn't feel ignored.
 */
export function ShareButton({
  path,
  title,
  label = "Share",
  className = "",
}: {
  /** App-relative, e.g. /posts/abc — the origin is added here. */
  path: string;
  title: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url =
      typeof window === "undefined" ? path : `${window.location.origin}${path}`;

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Dismissing the sheet rejects, which isn't a failure — fall
        // through to copying only if the sheet never opened.
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked without a user gesture in some
      // browsers. Nothing useful to say; the sheet is the main path.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className={`text-sm text-stone-600 underline underline-offset-4 hover:text-stone-900 ${className}`}
    >
      {copied ? "Link copied" : label}
    </button>
  );
}
