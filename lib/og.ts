/**
 * The image every share renders.
 *
 * Lives here rather than in the root layout because Next.js does not
 * deep-merge metadata: a page that declares its own `openGraph` block
 * replaces the parent's entirely, images included. So every page with
 * a custom title has to restate the image, and restating it from one
 * constant is the only way that stays true six pages later.
 *
 * This is exactly how it broke — the gate set its own openGraph title
 * and silently dropped the picture, so Facebook, WhatsApp and Instagram
 * had nothing to show while Twitter, which reads a different tag, was
 * fine.
 */
export const OG_IMAGE = {
  url: "/og-tournament.jpg",
  width: 1200,
  height: 630,
  alt: "Wasif Lay · 2026 Tournament Experience",
};
