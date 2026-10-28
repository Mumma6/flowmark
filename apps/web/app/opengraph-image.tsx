import { ImageResponse } from "next/og"

export const alt = "Flowmark — Understand every execution"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: 72,
        background: "#090c0e",
        color: "#edf2ef",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 56,
            height: 56,
            borderRadius: 14,
            border: "1px solid #b9f5974d",
            background: "#0d1311",
          }}
        >
          <svg width="29" height="29" viewBox="0 0 32 32">
            <path
              d="M6 25V7h20M6 16h14"
              stroke="#b9f597"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="25" cy="16" r="3" fill="#b9f597" />
            <circle cx="16" cy="25" r="3" fill="#b9f597" />
          </svg>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 36,
            fontWeight: 600,
            letterSpacing: -1,
          }}
        >
          flowmark
          <span style={{ color: "#b9f597" }}>.</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            fontSize: 64,
            fontWeight: 500,
            letterSpacing: -2.4,
            lineHeight: 1.05,
            maxWidth: 900,
          }}
        >
          Understand every execution.
        </div>
        <div
          style={{
            fontSize: 26,
            color: "#9ba8a3",
            lineHeight: 1.4,
            maxWidth: 760,
          }}
        >
          Discover what matters across them.
        </div>
      </div>
      <div style={{ display: "flex", gap: 28, color: "#b9f597", fontSize: 20 }}>
        <span>SDK</span>
        <span>Investigation</span>
        <span>Intelligence</span>
      </div>
    </div>,
    size,
  )
}
