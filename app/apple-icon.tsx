import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F5A623",
        }}
      >
        <svg width="180" height="180" viewBox="0 0 64 64">
          <g
            transform="translate(32 32) rotate(-30) scale(0.84) translate(-32 -32)"
            fill="#FFFFFF"
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
    ),
    size
  );
}
