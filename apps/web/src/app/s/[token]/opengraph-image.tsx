import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Private share on SanGit";

/** Wordmark-only card for private share links — reveals nothing about the
 *  content behind the token. */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#181818",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              display: "flex",
              width: 18,
              height: 18,
              borderRadius: 999,
              background: "#da291c",
            }}
          />
          <div
            style={{
              display: "flex",
              fontSize: 54,
              letterSpacing: 12,
              color: "#ffffff",
            }}
          >
            SANGIT
          </div>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 32,
            fontSize: 30,
            color: "#969696",
          }}
        >
          A private share — open the link to listen
        </div>
      </div>
    ),
    size
  );
}
