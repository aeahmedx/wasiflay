import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { SplashScreen } from "@/components/splash-screen";

const SITE = "https://www.wasiflay.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Wasif Lay",
    template: "%s · Wasif Lay",
  },
  description:
    "Ask the community, find someone who knows, and keep what gets learned. A home for the Sudanese community.",
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
    title: "Wasif Lay",
    description:
      "Ask the community, find someone who knows, and keep what gets learned.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wasif Lay",
    description:
      "Ask the community, find someone who knows, and keep what gets learned.",
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <SplashScreen />
        {children}
      </body>
    </html>
  );
}
