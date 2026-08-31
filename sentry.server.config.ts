import * as Sentry from "@sentry/nextjs";

/**
 * Server-side error reporting.
 *
 * Same reasoning as the client: no DSN means no reporting and no
 * failure. Nothing here is required for the app to run.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  enabled: process.env.NODE_ENV === "production",

  beforeSend(event) {
    if (event.user) {
      event.user = { id: event.user.id };
    }
    return event;
  },
});
