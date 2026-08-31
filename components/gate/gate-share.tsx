"use client";

import { useState } from "react";

const SITE = "https://www.wasiflay.com";

/**
 * Sharing the gate.
 *
 * The invite text matters more than the button. Someone forwarding this
 * into a group chat is vouching for it, and what they send is what
 * everyone else judges — so it can't be a bare link, and it can't read
 * like an advert either. Short, specific, and obviously written by a
 * person.
 *
 * The link itself renders a preview card with last year's pitch
 * invasion on it, so the message and the card do different jobs: the
 * message says why, the card says what.
 */
const INVITE =
  "Wasif Lay — call the scores for the tournament. " +
  "Nobody's won it yet so whoever tops the board is the first name on it.";

export function GateShare() {
  const [copied, setCopied] = useState(false);

  async function share() {
    // The native sheet lets people pick the group chat they already
    // had in mind, which is the whole path this travels.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Wasif Lay · 2026 Tournament Experience",
          text: INVITE,
          url: SITE,
        });
        return;
      } catch {
        // Dismissed, or unavailable — fall through to copying.
      }
    }

    try {
      await navigator.clipboard.writeText(`${INVITE}\n\n${SITE}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Nothing sensible left to do; the button simply does nothing
      // rather than showing an error for a share.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="block rounded-lg border-2 on-brand-border px-7 py-2.5 text-sm font-bold text-on-brand"
    >
      {copied ? "Copied" : "Share"}
    </button>
  );
}
