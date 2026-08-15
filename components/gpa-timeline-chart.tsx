"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface TimelinePoint {
  label: string
  color: string
  gpa: number
}

interface GpaTimelineChartProps {
  data: TimelinePoint[]
}

const VW = 600
const VH = 300
const PAD = { top: 28, right: 52, bottom: 58, left: 20 }
const REF_LINES = [1.0, 2.0, 3.0, 4.0]

function catmullRom(pts: [number, number][]): string {
  if (pts.length === 0) return ""
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(i + 2, pts.length - 1)]
    const t = 0.4
    const cp1x = p1[0] + ((p2[0] - p0[0]) * t) / 2
    const cp1y = p1[1] + ((p2[1] - p0[1]) * t) / 2
    const cp2x = p2[0] - ((p3[0] - p1[0]) * t) / 2
    const cp2y = p2[1] - ((p3[1] - p1[1]) * t) / 2
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2[0]} ${p2[1]}`
  }
  return d
}

export function GpaTimelineChart({ data }: GpaTimelineChartProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const hasData = Array.isArray(data) && data.length > 0

  const chart = useMemo(() => {
    if (!hasData) return null

    const gpas = data.map((d) => d.gpa)
    const rawMin = Math.min(...gpas)
    const rawMax = Math.max(...gpas)
    const spread = rawMax - rawMin
    const padding = Math.max(0.3, spread * 0.2)
    const domainMin = Math.max(0, rawMin - padding)
    const domainMax = Math.min(4, rawMax + padding)
    const domainRange = domainMax - domainMin || 0.5

    const cW = VW - PAD.left - PAD.right
    const cH = VH - PAD.top - PAD.bottom

    const toX = (i: number) =>
      data.length === 1 ? PAD.left + cW / 2 : PAD.left + (i / (data.length - 1)) * cW
    const toY = (gpa: number) =>
      PAD.top + cH - ((gpa - domainMin) / domainRange) * cH

    const points = data.map((d, i) => ({ ...d, x: toX(i), y: toY(d.gpa) }))
    const pts = points.map((p) => [p.x, p.y] as [number, number])
    const linePath = catmullRom(pts)
    const baseY = PAD.top + cH
    const areaPath =
      pts.length < 2
        ? ""
        : `${linePath} L ${pts[pts.length - 1][0]} ${baseY} L ${pts[0][0]} ${baseY} Z`

    const yTicks = REF_LINES.filter(
      (t) => t >= domainMin - 0.05 && t <= domainMax + 0.05,
    )

    return { points, linePath, areaPath, yTicks, toY, baseY }
  }, [data, hasData])

  if (!chart) return null

  const { points, linePath, areaPath, yTicks, toY, baseY } = chart

  return (
    <Card className="border-2 border-primary/35 bg-white">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-base text-primary font-bold">GPA Timeline</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 px-4 pb-3">
        <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full">
          <defs>
            <linearGradient id="tl-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Reference lines — labels on right */}
          {yTicks.map((tick) => {
            const y = toY(tick)
            return (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  y1={y}
                  x2={VW - PAD.right}
                  y2={y}
                  stroke="var(--border)"
                  strokeWidth="1"
                  strokeDasharray="4 5"
                  strokeOpacity="0.6"
                />
                <text
                  x={VW - PAD.right + 8}
                  y={y + 4}
                  textAnchor="start"
                  fontSize="11"
                  fill="var(--muted-foreground)"
                >
                  {tick.toFixed(1)}
                </text>
              </g>
            )
          })}

          {/* Baseline */}
          <line
            x1={PAD.left}
            y1={baseY}
            x2={VW - PAD.right}
            y2={baseY}
            stroke="var(--border)"
            strokeWidth="1.5"
            strokeOpacity="0.7"
          />

          {/* Area fill */}
          {areaPath && <path d={areaPath} fill="url(#tl-area)" />}

          {/* Line */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.85"
            />
          )}

          {/* Dots + labels */}
          {points.map((pt, i) => {
            const isHov = hovered === i
            return (
              <g
                key={i}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "default" }}
              >
                {/* GPA value above dot */}
                <text
                  x={pt.x}
                  y={pt.y - 16}
                  textAnchor="middle"
                  fontSize="14"
                  fontWeight="700"
                  fill={pt.color}
                >
                  {pt.gpa.toFixed(2)}
                </text>

                {/* Glow */}
                {isHov && (
                  <circle cx={pt.x} cy={pt.y} r={14} fill={pt.color} opacity="0.15" />
                )}

                {/* Dot */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHov ? 9 : 7}
                  fill={pt.color}
                  stroke="var(--card)"
                  strokeWidth="2.5"
                  style={{ transition: "r 0.12s ease" }}
                />

                {/* Semester label */}
                {data.length > 4 ? (
                  <text
                    x={0}
                    y={0}
                    textAnchor="end"
                    fontSize="11"
                    fill="var(--foreground)"
                    opacity="0.8"
                    transform={`translate(${pt.x + 4}, ${baseY + 16}) rotate(-38)`}
                  >
                    {pt.label}
                  </text>
                ) : (
                  <text
                    x={pt.x}
                    y={baseY + 20}
                    textAnchor="middle"
                    fontSize="12"
                    fill="var(--foreground)"
                    opacity="0.8"
                  >
                    {pt.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </CardContent>
    </Card>
  )
}
