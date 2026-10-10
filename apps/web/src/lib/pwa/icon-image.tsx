import { ImageResponse } from "next/og";
import { THEME_COLOR } from "./colors";

// The face stays inside the central 60% so maskable crops never cut it.
export function renderIcon(size: number) {
  const face = Math.round(size * 0.56);
  const eye = Math.round(face * 0.11);
  const eyeY = Math.round(face * 0.36);
  const eyeX = Math.round(face * 0.24);
  const smileW = Math.round(face * 0.42);
  const smileH = Math.round(face * 0.2);
  const smileY = Math.round(face * 0.52);
  const stroke = Math.max(2, Math.round(face * 0.06));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: THEME_COLOR,
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            width: face,
            height: face,
            borderRadius: face,
            background: "#ffffff",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: eyeX,
              top: eyeY,
              width: eye,
              height: eye,
              borderRadius: eye,
              background: THEME_COLOR,
            }}
          />
          <div
            style={{
              position: "absolute",
              right: eyeX,
              top: eyeY,
              width: eye,
              height: eye,
              borderRadius: eye,
              background: THEME_COLOR,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: Math.round((face - smileW) / 2),
              top: smileY,
              width: smileW,
              height: smileH,
              borderBottom: `${stroke}px solid ${THEME_COLOR}`,
              borderLeft: `${stroke}px solid ${THEME_COLOR}`,
              borderRight: `${stroke}px solid ${THEME_COLOR}`,
              borderRadius: `0 0 ${smileW}px ${smileW}px`,
            }}
          />
        </div>
      </div>
    ),
    { width: size, height: size }
  );
}
