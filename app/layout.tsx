import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import "./globals.css";
import { SplashScreen } from "@/components/splash-screen";
import { ActivityPing, ACTIVE_COOKIE } from "@/components/activity-ping";
import { PostHogProvider } from "@/components/analytics/posthog-provider";
import { OG_IMAGE } from "@/lib/og";

const SITE = "https://www.wasiflay.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Wasif Lay",
    template: "%s · Wasif Lay",
  },
  description:
    "Call every score, argue through every match, and finish top of a board nobody has ever topped. A home for the Sudanese community.",
  applicationName: "Wasif Lay",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Wasif Lay",
    statusBarStyle: "default",
  },
  // Every share into a WhatsApp group renders this. Without it the link
  // is a bare URL, which reads as spam in a community that is rightly
  // cautious about links.
  openGraph: {
    type: "website",
    siteName: "Wasif Lay",
    url: SITE,
    title: "Wasif Lay · 2026 Tournament Experience",
    description:
      "Call every score, argue through every match, and finish top of a board nobody has ever topped.",
    locale: "en_US",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Wasif Lay · 2026 Tournament Experience",
    description:
      "Call every score, argue through every match, and finish top of a board nobody has ever topped.",
    images: [OG_IMAGE.url],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5A623" },
    { media: "(prefers-color-scheme: dark)", color: "#202124" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  /**
   * Cold start or not, decided here on the server.
   *
   * The cookie expires ten minutes after the last activity, so its mere
   * presence answers the question — no timestamps, no comparing a
   * phone's clock against ours. Reloading, reconnecting after signal
   * loss, or coming back a minute later all skip the splash; opening
   * the app fresh shows it.
   *
   * Decided server-side because deciding on the client meant the two
   * disagreed, hydration broke, and the splash had no way to leave.
   */
  const coldStart = !(await cookies()).has(ACTIVE_COOKIE);

  return (
    <html lang="en">
      <body className="antialiased">
        {coldStart && <SplashScreen />}
        <ActivityPing />
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
