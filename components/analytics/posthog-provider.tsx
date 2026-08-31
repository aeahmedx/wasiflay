"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";

/**
 * Product analytics.
 *
 * The question worth answering this weekend is a narrow one: of the
 * people who tap the link, how many sign in, how many pick, and how
 * many come back. Not "engagement" — just where the drop is, so you
 * know which single thing to fix.
 *
 * Everything here no-ops without a key, so the app behaves identically
 * whether or not analytics is configured.
 */
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

let started = false;

function start() {
  if (started || !KEY || typeof window === "undefined") return;
  started = true;

  posthog.init(KEY, {
    api_host: HOST,

    // Pageviews are sent by hand below. The automatic version fires on
    // the first load only, which in an app that navigates client-side
    // means almost every screen goes unrecorded.
    capture_pageview: false,

    /**
     * No session recording, and no autocapture of what people type.
     *
     * Questions here are about money, immigration and family, some of
     * them asked anonymously. Recording a screen or a keystroke would
     * quietly break the promise anonymity makes. Knowing that someone
     * reached the pick screen is enough to fix a funnel.
     */
    disable_session_recording: true,
    autocapture: false,

    // Respects Do Not Track, and doesn't run in development where the
    // data would only be your own testing.
    respect_dnt: true,
    loaded: (ph) => {
      if (process.env.NODE_ENV === "development") ph.opt_out_capturing();
    },
  });
}

/**
 * Split out and wrapped in Suspense below.
 *
 * useSearchParams opts every route above it out of static rendering
 * unless it sits under a Suspense boundary — which would fail the
 * production build rather than degrade quietly.
 */
function PageViews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!KEY) return;

    const query = searchParams.toString();
    posthog.capture("$pageview", {
      $current_url: `${window.location.origin}${pathname}${
        query ? `?${query}` : ""
      }`,
    });
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    start();
  }, []);

  return (
    <>
      {children}

      {/* The boundary belongs here rather than on the caller: forgetting
          it would fail the build, and nobody should have to remember. */}
      <Suspense fallback={null}>
        <PageViews />
      </Suspense>
    </>
  );
}
