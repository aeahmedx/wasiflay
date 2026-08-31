"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * The last resort: an error that escaped every other boundary,
 * including the root layout.
 *
 * This replaces the whole document, so it carries its own html and
 * body — nothing above it survived to provide them.
 *
 * Styles are inline for the same reason: if the stylesheet is what
 * failed, a class name here would render as unstyled text on white.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is what appears in the Vercel log, so tagging with it
    // is what connects a report here to the line there.
    Sentry.captureException(error, { tags: { digest: error.digest } });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          background: "#f5a623",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          color: "#2b1d07",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "22rem" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "1.5rem",
              fontWeight: 800,
              lineHeight: 1.2,
            }}
          >
            Something broke
          </h1>

          <p style={{ marginTop: "0.75rem", lineHeight: 1.55, opacity: 0.85 }}>
            Not your fault, and it&apos;s been reported. Try again — if it
            keeps happening, email wasiflay@gmail.com.
          </p>

          <button
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.75rem 1.5rem",
              border: "none",
              borderRadius: "0.5rem",
              background: "#2b1d07",
              color: "#f5f1e8",
              fontSize: "1rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
