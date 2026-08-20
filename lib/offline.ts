/**
 * Shared plumbing for "this needs a connection".
 *
 * One event, one listener, one message. Any action that can't work
 * offline calls needsConnection() and the global banner shows the same
 * pill — rather than each component growing its own error UI, or worse,
 * failing silently and looking broken.
 */

export const NEEDS_CONNECTION = "wl:needs-connection";

/** True when the browser reports no network at all. */
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

/**
 * Tell the person their tap needs a connection. Returns true when it
 * fired, so callers can use it as a guard:
 *
 *   if (announceIfOffline()) return;
 */
export function announceIfOffline(): boolean {
  if (!isOffline()) return false;
  window.dispatchEvent(new CustomEvent(NEEDS_CONNECTION));
  return true;
}
