import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";


const nextConfig: NextConfig = {
  // Keep whatever you already had here. If your existing next.config.ts
  // has options, paste them into this object rather than replacing the
  // file wholesale.
};

/**
 * Sentry is wrapped conditionally.
 *
 * withSentryConfig tries to upload source maps at build time, and
 * without an auth token it warns loudly and can slow the build. Wrapping
 * only when the DSN exists means a machine with no Sentry credentials —
 * a fresh clone, a preview deploy, this repo on someone else's laptop —
 * builds exactly as it did before any of this existed.
 */
export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      silent: true,
      // Source maps are uploaded then deleted, so a stack trace is
      // readable in Sentry without shipping the maps to the browser.
      widenClientFileUpload: true,
      // Routes Sentry's own requests through your domain, so ad blockers
      // don't silently swallow the error reports you installed this for.
      tunnelRoute: "/monitoring",
    })
  : nextConfig;
