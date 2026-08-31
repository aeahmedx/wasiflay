/**
 * Picks made before signing in.
 *
 * Someone who has already chosen a scoreline has committed something —
 * and a person who has committed finishes a sign-up they would
 * otherwise abandon. So the order is inverted: pick first, account
 * second, and the picks follow them through.
 *
 * A cookie rather than localStorage because OAuth is a full page
 * navigation away and back. Both survive it, but a cookie can also be
 * read server-side later if that ever becomes useful.
 *
 * Deliberately lossy. If the cookie is missing, malformed, expired, or
 * the write fails, the person is simply signed in with no picks — which
 * is exactly where they'd have been without any of this. Nothing here
 * can leave someone worse off than the old flow.
 */

const COOKIE = "wl_pending_picks";
const MAX_AGE = 60 * 60 * 2; // two hours: long enough for a sign-up

export type PendingPick = { matchId: string; home: number; away: number };

export function savePendingPicks(picks: PendingPick[]) {
  if (typeof document === "undefined" || picks.length === 0) return;

  try {
    const value = encodeURIComponent(JSON.stringify(picks.slice(0, 12)));
    document.cookie = `${COOKIE}=${value}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
  } catch {
    // A pick that can't be stored just isn't stored.
  }
}

export function readPendingPicks(): PendingPick[] {
  if (typeof document === "undefined") return [];

  try {
    const raw = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${COOKIE}=`))
      ?.split("=")[1];

    if (!raw) return [];

    const parsed = JSON.parse(decodeURIComponent(raw));
    if (!Array.isArray(parsed)) return [];

    // Validate rather than trust: this came from a cookie, and a
    // malformed one should be ignored, not passed to the database.
    return parsed.filter(
      (p): p is PendingPick =>
        typeof p?.matchId === "string" &&
        Number.isInteger(p?.home) &&
        Number.isInteger(p?.away) &&
        p.home >= 0 &&
        p.home <= 20 &&
        p.away >= 0 &&
        p.away <= 20
    );
  } catch {
    return [];
  }
}

export function clearPendingPicks() {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}
