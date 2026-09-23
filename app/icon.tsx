import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
        <div style={{ position: "relative", width: 320, height: 320, display: "flex" }}>
          <div
            style={{
              position: "absolute",
              width: 230,
              height: 310,
              left: 30,
              top: 5,
              borderRadius: 56,
              background: "linear-gradient(135deg, #ffd166, #ff8a5c)",
              transform: "rotate(11deg)",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 230,
              height: 310,
              left: 60,
              top: 5,
              borderRadius: 56,
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
