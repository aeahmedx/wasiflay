import type { MetadataRoute } from "next";

/**
 * Makes the app installable. A browser tab is gone by Tuesday; an icon
 * on the home screen is the retention mechanism, and it's what you point
 * at while onboarding people in person.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wasif Lay",
    short_name: "Wasif Lay",
    description:
      "Ask the community, find someone who knows, and keep what gets learned.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FAF7F2",
    theme_color: "#F5A623",
    categories: ["social", "lifestyle"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
