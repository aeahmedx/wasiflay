/**
 * Mirrors the checks in migration 0023 so people find out before they
 * hit send, not after.
 *
 * The server is the authority — this can be bypassed and that's fine.
 * Its job is to be honest ahead of time, not to enforce anything.
 *
 * The governing rule: sharing a phone number IS the product. "Who knows
 * a mechanic?" → "Call Ahmed, 215-555-0134" is the exchange this
 * platform exists for. Contact details get a heads-up, never a block.
 */

/** Arabic-Indic and Persian/Urdu digits read as digits to the people
 *  typing them, and a check that only understands 0-9 is bypassed by
 *  typing ٠١٢ instead. */
export function normalizeDigits(text: string): string {
  return text.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (d) => {
    const code = d.charCodeAt(0);
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
}

export type ContentFlag = "phone" | "email" | "link" | "invite";

export type ContentCheck = {
  flags: ContentFlag[];
  /** Blocked outright — a real card number. */
  hasCardNumber: boolean;
};

/** Luhn. Without it, every order number and tracking code looks like a card. */
function luhnOk(digits: string): boolean {
  if (!/^\d{13,19}$/.test(digits)) return false;
  let total = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    total += d;
    double = !double;
  }
  return total % 10 === 0;
}

export function checkContent(text: string): ContentCheck {
  const norm = normalizeDigits(text ?? "");
  const flags: ContentFlag[] = [];

  if (!norm.trim()) return { flags, hasCardNumber: false };

  // Phone: seven or more digits with phone-ish separators. The floor
  // keeps years, prices and street numbers out of it.
  const phoneMatch = norm.match(/\+?\d[\d\s().-]{5,}\d/);
  if (phoneMatch && phoneMatch[0].replace(/\D/g, "").length >= 7) {
    flags.push("phone");
  }

  if (/[\w.%+-]+@[\w.-]+\.[a-z]{2,}/i.test(norm)) {
    flags.push("email");
  }

  if (/(chat\.whatsapp\.com|t\.me\/|discord\.gg|join\.slack\.com)/i.test(norm)) {
    flags.push("invite");
  } else if (/(https?:\/\/|www\.)/i.test(norm)) {
    flags.push("link");
  }

  const cardCandidates = norm.match(/(?:\d[ -]?){13,19}/g) ?? [];
  const hasCardNumber = cardCandidates.some((c) =>
    luhnOk(c.replace(/\D/g, ""))
  );

  return { flags, hasCardNumber };
}

/**
 * What someone actually reads. Written as information, not accusation —
 * these are things they probably meant to do.
 */
export function warningFor(flags: ContentFlag[]): string | null {
  if (flags.length === 0) return null;

  const parts: string[] = [];
  if (flags.includes("phone")) parts.push("a phone number");
  if (flags.includes("email")) parts.push("an email address");
  if (flags.includes("invite")) parts.push("a group invite link");
  else if (flags.includes("link")) parts.push("a link");

  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

  return `This includes ${list}. Anyone can see it, and it'll be reviewed by a moderator. Post it if you meant to.`;
}

export const CARD_NUMBER_MESSAGE =
  "That looks like a card number. Take it out — never post card details anywhere, including here.";

/**
 * Maps the database's error codes onto something readable.
 *
 * Anything unrecognised returns null so the caller can show the raw
 * message. A generic "check your connection" on a server-side rejection
 * is actively misleading — the connection is fine, the write was
 * refused, and hiding why makes it undiagnosable.
 */
export function contentErrorMessage(raw: string): string | null {
  if (raw.includes("CARD_NUMBER")) return CARD_NUMBER_MESSAGE;
  if (raw.includes("DUPLICATE"))
    return "You've already posted this. Change it or wait a while.";
  if (raw.includes("UPLOAD_LIMIT"))
    return "That's a lot of photos for one day. Try again tomorrow.";
  if (raw.includes("RATE_LIMIT")) return "Slow down a second.";
  return null;
}
