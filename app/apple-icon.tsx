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
          background: "#161221",
        }}
      >
        <div style={{ position: "relative", width: 120, height: 120, display: "flex" }}>
          <div
            style={{
              position: "absolute",
              width: 86,
              height: 116,
              left: 10,
              top: 2,
              borderRadius: 22,
              background: "linear-gradient(135deg, #ffd166, #ff8a5c)",
              transform: "rotate(11deg)",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 86,
              height: 116,
              left: 24,
              top: 2,
              borderRadius: 22,
              background: "linear-gradient(135deg, #ff5d5d, #ff8a5c)",
              transform: "rotate(-11deg)",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
