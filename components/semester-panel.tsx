"use client"

import { useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart3, PieChart } from "lucide-react"
import {
  calculateCourseGrade,
  calculateGPA,
  getLetterGrade,
  getLetterGradeColor,
} from "@/lib/grade-utils"
import type { Course } from "@/lib/types"
import { RollingNumber } from "@/components/rolling-number"

interface SemesterPanelProps {
  courses: Course[]
}

const GRADE_ORDER = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F"]

const CHART_COLORS: Record<string, string> = {
  "A+": "#e8756a", "A": "#d9645a", "A-": "#c5534a",
  "B+": "#e8a068", "B": "#d98e58", "B-": "#c57e4a",
  "C+": "#d9c058", "C": "#c8ae48", "C-": "#b59a3a",
  "D+": "#9898d0", "D": "#8484be", "D-": "#7070ac",
  "F": "#8a8a8a",
}

interface ChartEntry { letter: string; count: number; color: string; pct: number }

export function SemesterPanel({ courses }: SemesterPanelProps) {
  const [chartType, setChartType] = useState<"bar" | "pie">("bar")
  const safeCourses = Array.isArray(courses) ? courses : []
  const gpa = calculateGPA(safeCourses)
  const totalCredits = safeCourses.reduce((sum, c) => sum + c.credits, 0)

  const courseRows = useMemo(() =>
    safeCourses.map((course) => {
      const grade = calculateCourseGrade(course.criteria, course.percentBoost)
      const letter = getLetterGrade(grade, course.gradeScale)
      const color = getLetterGradeColor(letter)
      return { course, grade, letter, color }
    }),
    [safeCourses]
  )

  const chartData = useMemo((): ChartEntry[] => {
    if (!safeCourses.length) return []
    const dist: Record<string, number> = {}
    for (const { letter } of courseRows) {
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
  }, [courseRows, safeCourses.length])

  const chartTotal = chartData.reduce((s, d) => s + d.count, 0)
  const maxCount = Math.max(...chartData.map((d) => d.count), 1)

  return (
    <Card className="border-2 border-primary shadow-under-white-strong overflow-hidden">
      <CardContent className="p-0">
        <div className="flex min-h-0">

          {/* ── Left: stats + course list ── */}
          <div className="flex flex-1 flex-col min-w-0 p-5">

            {/* Stat row */}
            <div className="flex items-center gap-6 pb-4 mb-4 border-b border-border/40">
              <div>
                <p className="text-3xl font-bold text-primary leading-none">
                  <RollingNumber value={gpa} decimals={2} />
                </p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">GPA</p>
              </div>
              <div className="h-8 w-px bg-border/50" />
              <div>
                <p className="text-3xl font-bold text-primary leading-none">
                  <RollingNumber value={totalCredits} decimals={0} />
                </p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Credits</p>
              </div>
              <div className="h-8 w-px bg-border/50" />
              <div>
                <p className="text-3xl font-bold text-primary leading-none">
                  <RollingNumber value={safeCourses.length} decimals={0} />
                </p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Courses</p>
              </div>
            </div>

            {/* Course list — grid so all rows share column widths */}
            <div
              className={`grid gap-y-1 ${
                courseRows.length > 5
                  ? "overflow-y-auto max-h-[180px] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-primary/30"
                  : ""
              }`}
              style={{ gridTemplateColumns: "1fr auto auto auto" }}
            >
              {courseRows.map(({ course, grade, letter, color }) => (
                <div key={course.id} className="contents group">
                  <span className="rounded-l-lg pl-3 pr-2 py-1.5 text-sm font-medium text-foreground/90 bg-muted/30 group-hover:bg-muted/50 transition-colors truncate min-w-0">{course.name}</span>
                  <span className="px-2 py-1.5 text-xs text-muted-foreground bg-muted/30 group-hover:bg-muted/50 transition-colors whitespace-nowrap">{course.credits} cr</span>
                  <span className="px-2 py-1.5 text-xs font-semibold text-primary tabular-nums bg-muted/30 group-hover:bg-muted/50 transition-colors">
                    <RollingNumber value={grade} decimals={1} />%
                  </span>
                  <span className="rounded-r-lg pl-1 pr-3 py-1.5 text-xs font-bold text-right bg-muted/30 group-hover:bg-muted/50 transition-colors" style={{ color }}>
                    {letter}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Divider ── */}
          {chartData.length > 0 && (
            <div className="w-px bg-border/40 self-stretch" />
          )}

          {/* ── Right: chart ── */}
          {chartData.length > 0 && (
            <div className="flex w-[220px] shrink-0 flex-col p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Distribution</p>
                <div className="flex gap-0.5">
                  <Button
                    variant={chartType === "bar" ? "default" : "ghost"}
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setChartType("bar")}
                    title="Bar chart"
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={chartType === "pie" ? "default" : "ghost"}
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setChartType("pie")}
                    title="Donut chart"
                  >
                    <PieChart className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="mt-auto">
                {chartType === "bar" ? (
                  <BarView data={chartData} maxCount={maxCount} />
                ) : (
                  <DonutView data={chartData} total={chartTotal} />
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

const BAR_MAX_PX = 100

function BarView({ data, maxCount }: { data: ChartEntry[]; maxCount: number }) {
  return (
    <div className="flex w-full items-end gap-1" style={{ height: `${BAR_MAX_PX + 38}px` }}>
      {data.map(({ letter, count, color, pct }) => {
        const barH = Math.max(14, (count / maxCount) * BAR_MAX_PX)
        return (
          <div key={letter} className="flex flex-1 flex-col items-center gap-0.5">
            <span className="text-[9px] font-medium text-muted-foreground">{pct}%</span>
            <div
              className="w-full rounded-t-md transition-all duration-500 flex items-start justify-center pt-1"
              style={{ height: `${barH}px`, backgroundColor: color, boxShadow: `0 -2px 8px ${color}55` }}
            >
              <span className="text-[9px] font-bold text-white/90 drop-shadow">{count}</span>
            </div>
            <div className="h-px w-full bg-border/40" />
            <span className="text-[9px] font-semibold text-foreground">{letter}</span>
          </div>
        )
      })}
    </div>
  )
}

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
    return [`M ${p1.x} ${p1.y}`, `A ${outerR} ${outerR} 0 ${large} 1 ${p2.x} ${p2.y}`, `L ${p3.x} ${p3.y}`, `A ${innerR} ${innerR} 0 ${large} 0 ${p4.x} ${p4.y}`, "Z"].join(" ")
  }

  const labelR = (outerR + innerR) / 2

  return (
    <div className="flex flex-col items-center justify-center flex-1">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="145" height="145">
        {slices.map((s) => {
          const midDeg = (s.start + s.fraction / 2) * 360
          const lp = arc(cx, cy, labelR, midDeg)
          const showLabel = s.fraction >= 1 || s.fraction > 0.07

          if (s.fraction >= 1) {
            return (
              <g key={s.letter}>
                <circle cx={cx} cy={cy} r={outerR} fill={s.color} />
                <circle cx={cx} cy={cy} r={innerR} fill="var(--card)" />
                <text x={cx} y={cy - 4} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">{s.letter}</text>
                <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fill="#fff" opacity="0.85">{s.pct}%</text>
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
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--foreground)">{total}</text>
        <text x={cx} y={cy + 11} textAnchor="middle" fontSize="8" letterSpacing="1.5" fill="var(--muted-foreground)">COURSES</text>
      </svg>
    </div>
  )
}
