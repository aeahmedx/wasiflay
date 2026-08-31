import * as Sentry from "@sentry/nextjs";

/**
 * Browser error reporting.
 *
 * Runs before the app becomes interactive, so a crash during hydration
 * is still caught. Named instrumentation-client.ts rather than the
 * older sentry.client.config.ts, which is the pattern Next.js expects
 * from 15 onwards.
 *
 * With no DSN set this initialises and sends nothing — so the app runs
 * identically whether or not Sentry is configured, and a missing env
 * var can never take the site down.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Everything in development, a tenth in production. A community app
  // of a few hundred people doesn't need full traces, and the free
  // tier is a real ceiling.
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // Off in development, where the noise outweighs the signal.
  enabled: process.env.NODE_ENV === "production",

  /**
   * Deliberately no session replay.
   *
   * People ask about immigration paperwork, money and family here,
   * some of it anonymously. Recording their screens would quietly
   * undo the promise anonymity makes, and no debugging convenience is
   * worth that.
   */

  // Noise that isn't ours: browser extensions, dead network requests
  // on a phone that walked out of signal at a pitch.
  ignoreErrors: [
    "ResizeObserver loop",
    "Non-Error promise rejection captured",
    "Failed to fetch",
    "NetworkError",
    "AbortError",
    "Load failed",
  ],

  beforeSend(event) {
    // Strip anything identifying beyond the user id. Sentry needs to
    // know that someone hit an error, not who they are.
    if (event.user) {
      event.user = { id: event.user.id };
    }
    return event;
  },
});

/** Instruments client-side navigations for tracing. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
