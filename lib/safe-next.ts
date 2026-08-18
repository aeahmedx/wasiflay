/**
 * Validates a post-auth return path.
 *
 * Only same-origin absolute paths are allowed. Anything else — a full URL,
 * a protocol-relative "//evil.com", a backslash variant — is discarded and
 * falls back to "/". Without this check, ?next= is an open redirect: an
 * attacker could send a genuine Wasif Lay sign-in link that lands the user
 * on a lookalike page immediately after they authenticate.
 */
export function safeNext(value: string | null | undefined): string {
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}
