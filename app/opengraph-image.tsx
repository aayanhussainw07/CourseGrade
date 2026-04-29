import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "CourseGrade grade tracking dashboard preview";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

const paper = "#fff8f1";
const paperEdge = "#f1c8c0";
const primary = "#c95a50";
const deepRed = "#340008";
const ink = "#4a1f1b";
const mutedInk = "#8f5b54";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          backgroundColor: deepRed,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.09) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          color: ink,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 20,
            background: primary,
          }}
        />
        <div
          style={{
            width: 980,
            height: 450,
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            border: `6px solid ${paperEdge}`,
            borderRadius: 30,
            background: paper,
            padding: "56px 64px",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -22,
              left: 92,
              width: 178,
              height: 42,
              background: "rgba(242, 201, 192, 0.7)",
              transform: "rotate(-2deg)",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 78,
              bottom: -18,
              width: 150,
              height: 36,
              background: "rgba(242, 201, 192, 0.64)",
              transform: "rotate(3deg)",
            }}
          />

          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 62,
                height: 62,
                borderRadius: 18,
                background: primary,
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 34,
                fontWeight: 900,
              }}
            >
              cg
            </div>
            <div
              style={{
                fontSize: 44,
                fontWeight: 900,
                letterSpacing: -1,
                color: ink,
              }}
            >
              coursegrade.
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div
              style={{
                maxWidth: 790,
                fontSize: 68,
                lineHeight: 0.96,
                fontWeight: 900,
                letterSpacing: -2,
                color: ink,
              }}
            >
              Know your GPA before the final does.
            </div>
            <div
              style={{
                maxWidth: 820,
                fontSize: 28,
                lineHeight: 1.28,
                color: mutedInk,
              }}
            >
              Track grades, GPA, credits, and what-if scenarios without
              wrestling another spreadsheet.
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {[
              ["3.71", "GPA"],
              ["18", "credits"],
              ["what-if", "planning"],
            ].map(([value, label], index) => (
              <div
                key={label}
                style={{
                  minWidth: index === 2 ? 210 : 138,
                  border: `3px solid ${paperEdge}`,
                  borderRadius: 18,
                  background: "rgba(255, 255, 255, 0.72)",
                  padding: "16px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  transform: `rotate(${index === 1 ? "1" : index === 2 ? "-1" : "0"}deg)`,
                }}
              >
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 900,
                    color: primary,
                    lineHeight: 1,
                  }}
                >
                  {value}
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    color: mutedInk,
                  }}
                >
                  {label}
                </div>
              </div>
            ))}
            <div
              style={{
                marginLeft: "auto",
                fontSize: 26,
                fontWeight: 800,
                color: primary,
              }}
            >
              coursegrade.io
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
