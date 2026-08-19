import { ImageResponse } from "next/og";

export const alt = "Wasif Lay — ask the community, find someone who knows";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The most-viewed surface in the product: every share into a WhatsApp
 * group renders this.
 *
 * Built to echo the wordmark treatment — a cream panel floating on the
 * brand yellow, with the signpost breaking into the type rather than
 * sitting politely beside it. Depth comes from a soft radial wash and a
 * grounded shadow, so it reads as designed rather than assembled.
 */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 28% 18%, #FFC356 0%, #F5A623 46%, #E08F12 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* cream panel */}
        <div
          style={{
            width: 1032,
            height: 462,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#FDF8EC",
            borderRadius: 64,
            boxShadow: "0 24px 60px rgba(43, 29, 7, 0.28)",
          }}
        >
          {/*
            The signpost stands in for the F, so it reads as one word:
            WASI-post-LAY. Negative margins pull the letterforms tight
            against the mark rather than leaving it parked in a gap.
          */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontSize: 132,
                fontWeight: 900,
                color: "#2B1D07",
                letterSpacing: -2,
              }}
            >
              WASI
            </div>

            {/*
              The svg box carries its own padding around the glyph, and
              the 30° lean shifts the pole off the box's centre — so the
              margins aren't symmetric. These pull the mark in tight
              against the I and keep it optically centred between the two
              halves of the word.
            */}
            <div
              style={{
                display: "flex",
                marginLeft: -34,
                marginRight: -26,
                marginTop: 6,
              }}
            >
              <svg width="150" height="150" viewBox="0 0 64 64">
                <g
                  transform="translate(32 32) rotate(-30) scale(0.92) translate(-32 -32)"
                  fill="#FDF8EC"
                  stroke="#2B1D07"
                  strokeWidth="3"
                  strokeLinejoin="round"
                >
                  <path d="M29.5 7 h5 v50 h-5 z" />
                  <path d="M34.5 13 h17 l6 5.5 -6 5.5 h-17 z" />
                  <path d="M29.5 26 h-16 l-6 5.5 6 5.5 h16 z" />
                  <path d="M34.5 39 h14 l6 5.5 -6 5.5 h-14 z" />
                </g>
              </svg>
            </div>

            <div
              style={{
                fontSize: 132,
                fontWeight: 900,
                color: "#2B1D07",
                letterSpacing: -2,
              }}
            >
              LAY
            </div>
          </div>

          <div
            style={{
              marginTop: 18,
              fontSize: 40,
              color: "#6B5327",
              letterSpacing: -0.5,
            }}
          >
            Ask the community. Find someone who knows.
          </div>

          <div
            style={{
              marginTop: 34,
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div
              style={{
                width: 44,
                height: 6,
                borderRadius: 3,
                background: "#F5A623",
              }}
            />
            <div
              style={{
                fontSize: 30,
                fontWeight: 700,
                color: "#2B1D07",
                letterSpacing: 3,
              }}
            >
              WASIFLAY.COM
            </div>
            <div
              style={{
                width: 44,
                height: 6,
                borderRadius: 3,
                background: "#F5A623",
              }}
            />
          </div>
        </div>
      </div>
    ),
    size
  );
}
