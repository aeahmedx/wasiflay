import Image from "next/image";

/**
 * The wordmark, from the artwork in /public.
 *
 * The source files are square with the lockup centred and a lot of
 * transparent padding, which creates a tension:
 *
 *   - rendered whole, the type is tiny in a header
 *   - cropped tight, anything sitting off-centre gets clipped
 *
 * So the two uses are handled differently. The splash has room, so it
 * renders the whole square and can never clip. The header is short, so
 * it crops — but to a window with real margin around the artwork rather
 * than one sized exactly to it.
 *
 * The artwork is black line art on transparent, so it's inverted to
 * white in dark mode by the .brand-art rule in globals.css.
 */

/**
 * Width-to-height ratio of the header's crop window. Deliberately looser
 * than the artwork needs: a shorter window means more margin above and
 * below the letters. Lower this number if anything still clips.
 */
const HEADER_CROP_RATIO = 4.4;

export function Wordmark({
  size = "md",
  tagline = false,
  className = "",
  priority = false,
}: {
  size?: "sm" | "md" | "lg";
  tagline?: boolean;
  className?: string;
  priority?: boolean;
}) {
  const width = { sm: 150, md: 200, lg: 320 }[size];
  const src = tagline ? "/logo-full.png" : "/logo-wordmark.png";

  // With the tagline — the splash — show the whole square. Nothing is
  // cropped, so nothing can be cut off, and the empty space around it
  // is invisible on a full-screen background anyway.
  if (tagline) {
    return (
      <span
        className={`relative block ${className}`}
        style={{ width, height: width }}
        role="img"
        aria-label="Wasif Lay — a step in the right direction"
      >
        <Image
          src={src}
          alt=""
          fill
          priority={priority}
          sizes={`${width}px`}
          className="object-contain brand-art"
        />
      </span>
    );
  }

  return (
    <span
      className={`relative block overflow-hidden ${className}`}
      style={{ width, height: Math.round(width / HEADER_CROP_RATIO) }}
      role="img"
      aria-label="Wasif Lay"
    >
      <Image
        src={src}
        alt=""
        fill
        priority={priority}
        sizes={`${width}px`}
        className="object-cover brand-art"
        // The lockup sits a touch below the middle of its square, so the
        // window is biased down to match. Centred, it clipped the
        // descenders.
        style={{ objectPosition: "center 52%" }}
      />
    </span>
  );
}

/** The signpost alone, for tight spaces. */
export function Mark({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`relative block ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label="Wasif Lay"
    >
      {/* Contained rather than cropped — the mark is small enough that
          scaling into the padding isn't worth the risk of clipping it. */}
      <Image
        src="/logo-mark.png"
        alt=""
        fill
        sizes={`${size}px`}
        className="object-contain brand-art"
      />
    </span>
  );
}
