import * as Sentry from "@sentry/nextjs";

/**
 * Server and edge error reporting.
 *
 * Next.js calls register() once per runtime at startup. The config
 * modules are imported dynamically because the Node and edge builds
 * can't share one — importing both eagerly would pull Node APIs into
 * the edge bundle and fail the build.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/**
 * Errors thrown in Server Components, route handlers and middleware.
 * Without this they surface as a digest hash in the Vercel log and
 * nothing else — which is exactly the failure you can't debug.
 */
export const onRequestError = Sentry.captureRequestError;
