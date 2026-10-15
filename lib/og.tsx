import { ImageResponse } from "next/og";

export const ogSize = { width: 1200, height: 630 };

/**
 * Brand Open Graph card: warm off-white background, indigo "p" mark,
 * big headline. Uses the built-in font so builds need no network access.
 */
export function renderOg({
  title,
  subtitle,
  footer = "Runs in your browser · files stay on your device",
}: {
  title: string;
  subtitle: string;
  footer?: string;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#fbfaf8",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: "#4f3ff0",
              border: "4px solid #3c2ed1",
              color: "white",
              fontSize: 40,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            p
          </div>
          <div style={{ fontSize: 44, fontWeight: 800, color: "#181a1f" }}>peedf</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 800, color: "#181a1f", lineHeight: 1.05, letterSpacing: -2 }}>
            {title}
          </div>
          <div style={{ fontSize: 34, color: "#6b7280", lineHeight: 1.3 }}>{subtitle}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 16, height: 16, borderRadius: 8, background: "#12b76a" }} />
          <div style={{ fontSize: 28, color: "#181a1f", fontWeight: 600 }}>
            {footer}
          </div>
        </div>
      </div>
    ),
    ogSize
  );
}
