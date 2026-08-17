"use client"

import { useMemo, useState } from "react"
import { CardContent } from "@/components/ui/card"
import { calculateCourseGrade, getLetterGrade } from "@/lib/grade-utils"
import type { Course } from "@/lib/types"

// ── Types ────────────────────────────────────────────────────────────────────

interface TimelinePoint {
  label: string
  color: string
  gpa: number
}

interface ChartEntry {
  letter: string
  count: number
  color: string
  pct: number
}

interface DashboardPanelProps {
  timelineData: TimelinePoint[]
  courses: Course[]
  bare?: boolean
  separated?: boolean
}

// ── Constants ────────────────────────────────────────────────────────────────

const GRADE_ORDER = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F"]

const CHART_COLORS: Record<string, string> = {
  "A+": "#e8756a", "A": "#d9645a", "A-": "#c5534a",
  "B+": "#e8a068", "B": "#d98e58", "B-": "#c57e4a",
  "C+": "#d9c058", "C": "#c8ae48", "C-": "#b59a3a",
  "D+": "#9898d0", "D": "#8484be", "D-": "#7070ac",
  "F": "#8a8a8a",
}

// ── Timeline helpers ──────────────────────────────────────────────────────────

const VW = 600
const VH = 360
const PAD = { top: 34, right: 16, bottom: 58, left: 48 }
const REF_LINES = [1.0, 2.0, 3.0, 4.0, 4.33]

function sketchLine(pts: [number, number][]): string {
  if (pts.length === 0) return ""
  return pts
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x} ${y}`)
    .join(" ")
}

// ── Main component ────────────────────────────────────────────────────────────

export function DashboardPanel({
  timelineData,
  courses,
  bare = false,
  separated = false,
}: DashboardPanelProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  // Timeline chart data
  const timeline = useMemo(() => {
    const data = timelineData
    if (!data.length) return null
    const gpas = data.map((d) => d.gpa)
    const rawMin = Math.min(...gpas)
    const rawMax = Math.max(...gpas)
    const spread = rawMax - rawMin
    const padding = Math.max(0.3, spread * 0.2)
    const domainMin = Math.max(0, rawMin - padding)
    const domainMax = Math.min(4.4, rawMax + padding)
    const domainRange = domainMax - domainMin || 0.5
    const cW = VW - PAD.left - PAD.right
    const cH = VH - PAD.top - PAD.bottom
    const toX = (i: number) =>
      data.length === 1 ? PAD.left + cW / 2 : PAD.left + (i / (data.length - 1)) * cW
    const toY = (gpa: number) =>
      PAD.top + cH - ((gpa - domainMin) / domainRange) * cH
    const points = data.map((d, i) => ({ ...d, x: toX(i), y: toY(d.gpa) }))
    const pts = points.map((p) => [p.x, p.y] as [number, number])
    const linePath = sketchLine(pts)
    const baseY = PAD.top + cH
    const areaPath =
      pts.length < 2
        ? ""
        : `${linePath} L ${pts[pts.length - 1][0]} ${baseY} L ${pts[0][0]} ${baseY} Z`
    const yTicks = REF_LINES.filter((t) => t >= domainMin - 0.05 && t <= domainMax + 0.05)
    return { points, linePath, areaPath, yTicks, toY, baseY, chartWidth: cW, chartHeight: cH }
  }, [timelineData])

  // Distribution chart data
  const distData = useMemo((): ChartEntry[] => {
    if (!courses.length) return []
    const dist: Record<string, number> = {}
    for (const course of courses) {
      if (course.isPassFail) continue
      const numeric = calculateCourseGrade(course.criteria, course.percentBoost)
      const letter = getLetterGrade(numeric, course.gradeScale)
      dist[letter] = (dist[letter] || 0) + 1
    }
    const total = Object.values(dist).reduce((s, v) => s + v, 0)
    if (!total) return []
    return GRADE_ORDER.filter((l) => dist[l]).map((letter) => ({
      letter,
      count: dist[letter],
      color: CHART_COLORS[letter] ?? "#888",
      pct: Math.round((dist[letter] / total) * 100),
    }))
  }, [courses])

  const distTotal = distData.reduce((s, d) => s + d.count, 0)
  const maxCount = Math.max(...distData.map((d) => d.count), 1)

  const showDist = distData.length > 0
  const separatedPanelClass =
    "relative border border-primary/20 bg-[#fff8f1] transition-all duration-300 hover:-translate-y-1 hover:border-primary/35"
  const timelineLayoutClass = separated
    ? `${separatedPanelClass} ${showDist ? "md:col-span-2 xl:col-span-1" : "md:col-span-2 xl:col-span-3"}`
    : showDist
      ? "border-b border-primary/20 md:col-span-2 xl:col-span-1 xl:border-b-0 xl:border-r"
      : "md:col-span-2 xl:col-span-3"
  const barLayoutClass = separated
    ? separatedPanelClass
    : "border-b border-primary/20 md:border-b-0 md:border-r"
  const chartTitleClass =
    "mb-4 font-heading text-base font-bold uppercase tracking-wide text-primary"

  const inner = (
    <div
      className={`grid min-h-0 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 ${separated ? "gap-4" : ""}`}
    >

          {/* ── GPA timeline ── */}
          <div
            className={`flex min-w-0 flex-col p-4 md:p-6 ${timelineLayoutClass}`}
          >
            {separated && (
              <div className="pointer-events-none absolute -top-2 left-8 z-10 h-5 w-20 rotate-[-2deg] bg-primary/15" />
            )}
            <p className={chartTitleClass}>GPA Timeline</p>
            {timeline ? (
              <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full">
                <defs>
                  <pattern
                    id="dp-tl-grid"
                    width="24"
                    height="24"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 24 0 L 0 0 0 24"
                      fill="none"
                      stroke="var(--primary)"
                      strokeWidth="0.75"
                      opacity="0.11"
                    />
                  </pattern>
                  <linearGradient
                    id="dp-tl-area-colors"
                    gradientUnits="userSpaceOnUse"
                    x1={PAD.left}
                    y1="0"
                    x2={VW - PAD.right}
                    y2="0"
                  >
                    {timeline.points.map((point, index) => (
                      <stop
                        key={`${point.label}-${index}`}
                        offset={`${(index / Math.max(timeline.points.length - 1, 1)) * 100}%`}
                        stopColor={point.color}
                        stopOpacity="1"
                      />
                    ))}
                  </linearGradient>
                </defs>

                <rect
                  x={PAD.left}
                  y={PAD.top}
                  width={timeline.chartWidth}
                  height={timeline.chartHeight}
                  fill="#fffaf5"
                  stroke="var(--primary)"
                  strokeWidth="1"
                  strokeOpacity="0.18"
                />
                <rect
                  x={PAD.left}
                  y={PAD.top}
                  width={timeline.chartWidth}
                  height={timeline.chartHeight}
                  fill="url(#dp-tl-grid)"
                />

                {timeline.areaPath && (
                  <path d={timeline.areaPath} fill="url(#dp-tl-area-colors)" />
                )}

                {timeline.yTicks.map((tick) => {
                  const y = timeline.toY(tick)
                  return (
                    <g key={tick}>
                      <line x1={PAD.left} y1={y} x2={VW - PAD.right} y2={y}
                        stroke="var(--primary)" strokeWidth="1" strokeOpacity="0.16" />
                      <text x={PAD.left - 7} y={y + 4} textAnchor="end" fontSize="11" fill="var(--muted-foreground)" fontFamily="var(--font-display)">
                        {tick.toFixed(1)}
                      </text>
                    </g>
                  )
                })}

                <line x1={PAD.left} y1={timeline.baseY} x2={VW - PAD.right} y2={timeline.baseY}
                  stroke="var(--primary)" strokeWidth="1.5" strokeOpacity="0.35" />

                {timeline.linePath && (
                  <>
                    <path d={timeline.linePath} fill="none" stroke="var(--primary)"
                      strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.14"
                      transform="translate(0.7 0.7)" />
                    <path d={timeline.linePath} fill="none" stroke="var(--primary)"
                      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
                  </>
                )}

                {timeline.points.map((pt, i) => {
                  const isHov = hovered === i
                  const isOnly = timeline.points.length === 1
                  const isFirst = i === 0
                  const isLast = i === timeline.points.length - 1
                  const pointLabelX = isOnly ? pt.x : isFirst ? pt.x + 4 : isLast ? pt.x - 4 : pt.x
                  const pointLabelAnchor = isOnly ? "middle" : isFirst ? "start" : isLast ? "end" : "middle"
                  const semesterLabelAnchor = isOnly ? "middle" : isFirst ? "start" : isLast ? "end" : "middle"
                  return (
                    <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} style={{ cursor: "default" }}>
                      <text x={pointLabelX} y={pt.y - 14} textAnchor={pointLabelAnchor} fontSize="14"
                        fontWeight={isHov ? "800" : "700"} fill={pt.color} opacity={isHov ? 1 : 0.86}
                        fontFamily="var(--font-display)" style={{ transition: "opacity 0.12s ease" }}>
                        {pt.gpa.toFixed(2)}
                      </text>
                      <circle cx={pt.x} cy={pt.y} r="14" fill="transparent" />
                      <circle cx={pt.x} cy={pt.y} r="6.5" fill={isHov ? pt.color : "#fffaf5"}
                        stroke={pt.color} strokeWidth={isHov ? "3" : "2.25"}
                        style={{ transition: "fill 0.12s ease, stroke-width 0.12s ease" }} />
                      {timelineData.length > 4 ? (
                        <text x={0} y={0} textAnchor={semesterLabelAnchor} fontSize="11" fill="var(--foreground)" opacity="0.82"
                          fontFamily="var(--font-display)"
                          transform={`translate(${pt.x}, ${timeline.baseY + 18}) rotate(-32)`}>
                          {pt.label}
                        </text>
                      ) : (
                        <text x={pt.x} y={timeline.baseY + 20} textAnchor={semesterLabelAnchor} fontSize="12" fill="var(--foreground)" opacity="0.82"
                          fontFamily="var(--font-display)">
                          {pt.label}
                        </text>
                      )}
                    </g>
                  )
                })}
              </svg>
            ) : (
              <p className="text-sm text-muted-foreground">Add semesters to see your GPA over time.</p>
            )}
          </div>

          {/* ── Bar distribution ── */}
          {showDist && (
            <div className={`flex min-w-0 flex-col p-4 md:p-6 ${barLayoutClass}`}>
              {separated && (
                <div className="pointer-events-none absolute -top-2 left-1/2 z-10 h-5 w-20 -translate-x-1/2 rotate-[1deg] bg-primary/15" />
              )}
              <p className={chartTitleClass}>
                Bar Distribution
              </p>
              <div className="flex-1 flex items-center">
                <BarView data={distData} maxCount={maxCount} />
              </div>
            </div>
          )}

          {/* ── Pie distribution ── */}
          {showDist && (
            <div
              className={`flex min-w-0 flex-col p-4 md:p-6 ${separated ? separatedPanelClass : ""}`}
            >
              {separated && (
                <div className="pointer-events-none absolute -top-2 right-8 z-10 h-5 w-20 rotate-[3deg] bg-primary/15" />
              )}
              <p className={chartTitleClass}>
                Pie Distribution
              </p>
              <div className="flex flex-1 items-center">
                <DonutView data={distData} total={distTotal} />
              </div>
            </div>
          )}
    </div>
  )

  if (bare) return inner

  return (
    <div className="relative flex flex-col overflow-hidden rounded-md bg-[#fff8f1] py-0">
      <div className="pointer-events-none absolute -top-2 left-8 z-10 h-5 w-20 rotate-[-2deg] bg-primary/15" />
      <div className="pointer-events-none absolute -top-2 right-12 z-10 h-5 w-20 rotate-[3deg] bg-primary/15" />
      <CardContent className="p-0">{inner}</CardContent>
    </div>
  )
}

// ── Bar chart ─────────────────────────────────────────────────────────────────

const BAR_MAX_PX = 100

function BarView({ data, maxCount }: { data: ChartEntry[]; maxCount: number }) {
  return (
    <div className="flex w-full items-end gap-1" style={{ height: `${BAR_MAX_PX + 38}px` }}>
      {data.map(({ letter, count, color, pct }) => {
        const barH = Math.max(14, (count / maxCount) * BAR_MAX_PX)
        return (
          <div key={letter} className="flex flex-1 flex-col items-center gap-0.5">
            <span className="text-[9px] font-medium text-muted-foreground">{pct}%</span>
            <div className="w-full rounded-t-md transition-all duration-500 flex items-start justify-center pt-1"
              style={{ height: `${barH}px`, backgroundColor: color }}>
              <span className="text-[9px] font-bold text-white/90">{count}</span>
            </div>
            <div className="h-px w-full bg-border/40" />
            <span className="text-[9px] font-semibold text-foreground">{letter}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Donut chart ───────────────────────────────────────────────────────────────

function DonutView({ data, total }: { data: ChartEntry[]; total: number }) {
  const SIZE = 200
  const cx = SIZE / 2
  const cy = SIZE / 2
  const outerR = 88
  const innerR = 54
  const GAP = 1.8

  function arc(cx: number, cy: number, r: number, deg: number) {
    const rad = ((deg - 90) * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  let cum = 0
  const slices = data.map((entry) => {
    const start = cum
    cum += entry.count / total
    return { ...entry, start, fraction: entry.count / total }
  })

  function slicePath(start: number, fraction: number) {
    const startDeg = start * 360 + GAP / 2
    const endDeg = (start + fraction) * 360 - GAP / 2
    const large = (endDeg - startDeg) > 180 ? 1 : 0
    const p1 = arc(cx, cy, outerR, startDeg)
    const p2 = arc(cx, cy, outerR, endDeg)
    const p3 = arc(cx, cy, innerR, endDeg)
    const p4 = arc(cx, cy, innerR, startDeg)
    return [`M ${p1.x} ${p1.y}`, `A ${outerR} ${outerR} 0 ${large} 1 ${p2.x} ${p2.y}`,
      `L ${p3.x} ${p3.y}`, `A ${innerR} ${innerR} 0 ${large} 0 ${p4.x} ${p4.y}`, "Z"].join(" ")
  }

  const labelR = (outerR + innerR) / 2
  const singleSlice = slices.length === 1 ? slices[0] : null

  return (
    <div className="flex flex-col items-center justify-center flex-1">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-[220px]">
        {slices.map((s) => {
          const midDeg = (s.start + s.fraction / 2) * 360
          const lp = arc(cx, cy, labelR, midDeg)
          const showLabel = s.fraction >= 1 || s.fraction > 0.07
          if (s.fraction >= 1) {
            return (
              <g key={s.letter}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={(outerR + innerR) / 2}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={outerR - innerR}
                />
              </g>
            )
          }
          return (
            <g key={s.letter} className="cursor-pointer">
              <path d={slicePath(s.start, s.fraction)} fill={s.color} className="transition-opacity hover:opacity-75" />
              {showLabel && (
                <>
                  <text x={lp.x} y={lp.y - 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff" style={{ pointerEvents: "none" }}>{s.letter}</text>
                  <text x={lp.x} y={lp.y + 8} textAnchor="middle" fontSize="8" fill="#fff" opacity="0.85" style={{ pointerEvents: "none" }}>{s.pct}%</text>
                </>
              )}
            </g>
          )
        })}
        {singleSlice ? (
          <>
            <text x={cx} y={cy - 12} textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--foreground)">{singleSlice.letter}</text>
            <text x={cx} y={cy + 5} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--muted-foreground)">{singleSlice.pct}%</text>
            <text x={cx} y={cy + 20} textAnchor="middle" fontSize="8" letterSpacing="1.2" fill="var(--muted-foreground)">{total} {total === 1 ? "COURSE" : "COURSES"}</text>
          </>
        ) : (
          <>
            <text x={cx} y={cy - 6} textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--foreground)">{total}</text>
            <text x={cx} y={cy + 11} textAnchor="middle" fontSize="8" letterSpacing="1.5" fill="var(--muted-foreground)">COURSES</text>
          </>
        )}
      </svg>
    </div>
  )
}
