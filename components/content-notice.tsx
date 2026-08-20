"use client";

import { checkContent, warningFor, CARD_NUMBER_MESSAGE } from "@/lib/content-safety";

/**
 * Shown while someone types, not after they submit.
 *
 * Phrased as information rather than accusation — a phone number in a
 * post is almost always intentional and useful here. The one hard stop
 * is a card number, which has no legitimate use anywhere on the
 * platform.
 */
export function ContentNotice({ text }: { text: string }) {
  const { flags, hasCardNumber } = checkContent(text);

  if (hasCardNumber) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
      >
        {CARD_NUMBER_MESSAGE}
      </p>
    );
  }

  const warning = warningFor(flags);
  if (!warning) return null;

  return (
    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-stone-800">
      {warning}
    </p>
  );
}
