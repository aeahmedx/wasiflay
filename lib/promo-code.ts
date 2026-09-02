/**
 * The code from a printed card.
 *
 * Someone taps wasiflay.com/t/NY07, this is stored, and whoever creates
 * an account is credited to it. Thirty days, because a card handed out
 * on Saturday might be scanned on Sunday and acted on the week after.
 *
 * Deliberately forgiving. A missing or malformed cookie means an
 * unattributed sign-up, which is a reporting gap and nothing more —
 * attribution must never be able to block an account.
 */

export const PROMO_COOKIE = "wl_promo";
export const PROMO_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Codes are printed on cards and typed by humans, so they're normalised
 * hard: trimmed, uppercased, and anything that isn't a letter or digit
 * dropped. "ny 07" and "NY-07" both become "NY07".
 */
export function normalisePromoCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
  return clean.length >= 2 ? clean : null;
}

/** Client-side read, for attaching to a profile at creation. */
export function readPromoCode(): string | null {
  if (typeof document === "undefined") return null;

  const raw = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${PROMO_COOKIE}=`))
    ?.split("=")[1];

  return normalisePromoCode(raw ? decodeURIComponent(raw) : null);
}
