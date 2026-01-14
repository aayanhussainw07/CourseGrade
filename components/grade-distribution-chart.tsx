"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { calculateCourseGrade, getLetterGrade, getLetterGradeColor } from "@/lib/grade-utils"
import type { Course } from "@/lib/types"
import { BarChart3, PieChart } from "lucide-react"
import { useMemo, useState } from "react"

interface GradeDistributionChartProps {
  courses: Course[]
  title?: string
}

const GRADE_ORDER = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F"]
const MAX_BAR_HEIGHT = 130

const clampChannel = (value: number) => Math.max(0, Math.min(255, value))

const adjustColor = (hex: string, amount: number) => {
  const sanitized = hex.replace("#", "")
  if (sanitized.length !== 6) return hex
  const r = parseInt(sanitized.slice(0, 2), 16)
  const g = parseInt(sanitized.slice(2, 4), 16)
  const b = parseInt(sanitized.slice(4, 6), 16)
  const adjust = (channel: number) => Math.round(clampChannel(channel + 255 * amount))
  const toHex = (channel: number) => channel.toString(16).padStart(2, "0")
  return `#${toHex(adjust(r))}${toHex(adjust(g))}${toHex(adjust(b))}`
}

const getGradientPalette = (color: string) => ({
  light: adjustColor(color, 0.1),
  dark: adjustColor(color, -0.25),
})

const darkenColor = (hex: string, factor: number) => {
  const sanitized = hex.replace("#", "")
  if (sanitized.length !== 6) return hex
  const r = parseInt(sanitized.slice(0, 2), 16)
  const g = parseInt(sanitized.slice(2, 4), 16)
  const b = parseInt(sanitized.slice(4, 6), 16)
  const toHex = (channel: number) => channel.toString(16).padStart(2, "0")
  return `#${toHex(Math.round(r * factor))}${toHex(Math.round(g * factor))}${toHex(Math.round(b * factor))}`
}

export function GradeDistributionChart({ courses, title = "Grade Distribution" }: GradeDistributionChartProps) {
  const [chartType, setChartType] = useState<"bar" | "pie">("bar")
  const chartData = useMemo(() => {
    if (courses.length === 0) {
      return { totalCount: 0, bars: [] as ChartBar[], slices: [] as ChartSlice[] }
    }

    const distribution: Record<string, number> = {}

    for (const course of courses) {
      const numericGrade = calculateCourseGrade(course.criteria, course.percentBoost)
      const letterGrade = getLetterGrade(numericGrade, course.gradeScale)
      distribution[letterGrade] = (distribution[letterGrade] || 0) + 1
    }

    const ordered = GRADE_ORDER.map((letter, index) => ({
      letter,
      count: distribution[letter] || 0,
      gradientId: `grade-slice-${index}`,
    })).filter(({ count }) => count > 0)

    if (ordered.length === 0) {
      return { totalCount: 0, bars: [] as ChartBar[], slices: [] as ChartSlice[] }
    }

    const totalCount = ordered.reduce((sum, grade) => sum + grade.count, 0)

    const detailed = ordered.map((grade) => {
      const baseColor = darkenColor(getLetterGradeColor(grade.letter), 0.7)
      return {
        ...grade,
        baseColor,
        gradient: getGradientPalette(baseColor),
      }
    })

    const maxCount = Math.max(...detailed.map((grade) => grade.count), 1)
    const bars: ChartBar[] = detailed.map((detail) => ({
      ...detail,
      hasData: detail.count > 0,
      barHeight: detail.count ? Math.max(6, (detail.count / maxCount) * MAX_BAR_HEIGHT) : 0,
    }))

    let cumulativeFraction = 0
    const slices: ChartSlice[] = detailed.map((detail) => {
      const fraction = detail.count / totalCount
      const slice = {
        ...detail,
        fraction,
        startFraction: cumulativeFraction,
      }
      cumulativeFraction += fraction
      return slice
    })

    return { totalCount, bars, slices }
  }, [courses])

  if (courses.length === 0 || chartData.totalCount === 0) return null

  return (
    <Card className="border-2 border-primary/20 shadow-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl text-primary">{title}</CardTitle>
          <div className="flex gap-1">
            <Button
              variant={chartType === "bar" ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setChartType("bar")}
              title="Bar chart"
            >
              <BarChart3 className="h-5 w-4" />
            </Button>
            <Button
              variant={chartType === "pie" ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setChartType("pie")}
              title="Pie chart"
            >
              <PieChart className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="min-h-[250px]">
        {chartType === "bar" ? (
          <div className="mt-4 flex h-56 items-end justify-between gap-2 border-t border-border/40 pt-4">
            {chartData.bars.map(({ letter, count, gradient, baseColor, hasData, barHeight }) => (
              <div key={letter} className="flex min-w-[32px] flex-1 flex-col items-center">
                <div className="relative flex w-full flex-col items-center">
                  {hasData ? (
                    <div
                      className="flex w-full items-end justify-center rounded-t-md transition-all"
                      style={{
                        height: `${barHeight}px`,
                        backgroundImage: `linear-gradient(180deg, ${gradient.light}, ${gradient.dark})`,
                        backgroundColor: baseColor,
                      }}
                    >
                      <span className="mb-2 text-sm font-semibold text-white drop-shadow">{count}</span>
                    </div>
                  ) : (
                    <div className="flex h-12 w-full items-end justify-center">
                      <div className="h-1 w-full rounded-full bg-muted" />
                    </div>
                  )}
                  <div className="mt-2 h-1 w-full rounded-full bg-muted" />
                </div>
                <span className={`mt-2 text-xs font-semibold tracking-wide ${hasData ? "" : "text-muted-foreground"}`}>
                  {letter}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <svg viewBox="0 0 260 260" className="h-60 w-60">
              <defs>
                {chartData.slices.map(({ gradientId, gradient }) => (
                  <linearGradient key={gradientId} id={gradientId} gradientTransform="rotate(35)">
                    <stop offset="0%" stopColor={gradient.light} />
                    <stop offset="100%" stopColor={gradient.dark} />
                  </linearGradient>
                ))}
              </defs>
              {chartData.slices.map(({ letter, count, gradientId, baseColor, startFraction, fraction }) => {
                const radius = 110
                const center = 130
                if (fraction >= 1) {
                  return (
                    <g key={letter}>
                      <circle cx={center} cy={center} r={radius} fill={`url(#${gradientId})`} />
                      <text x={center} y={center - 6} fill="#ffffff" fontSize="16" fontWeight="700" textAnchor="middle">
                        {letter}
                      </text>
                      <text x={center} y={center + 12} fill="#ffffff" fontSize="12" textAnchor="middle">
                        {count}
                      </text>
                    </g>
                  )
                }

                const startAngle = startFraction * 360
                const angle = fraction * 360
                const endAngle = startAngle + angle

                const startRad = ((startAngle - 90) * Math.PI) / 180
                const endRad = ((endAngle - 90) * Math.PI) / 180

                const x1 = center + radius * Math.cos(startRad)
                const y1 = center + radius * Math.sin(startRad)
                const x2 = center + radius * Math.cos(endRad)
                const y2 = center + radius * Math.sin(endRad)

                const largeArc = angle > 180 ? 1 : 0
                const path = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`

                const midAngle = ((startAngle + endAngle) / 2 - 90) * (Math.PI / 180)
                const labelRadius = radius * 0.65
                const labelX = center + labelRadius * Math.cos(midAngle)
                const labelY = center + labelRadius * Math.sin(midAngle)

                return (
                  <g key={letter}>
                    <path d={path} fill={`url(#${gradientId})`} stroke={baseColor} strokeWidth="0.5" />
                    <text
                      x={labelX}
                      y={labelY - 6}
                      fill="#ffffff"
                      fontSize="12"
                      fontWeight="700"
                      textAnchor="middle"
                    >
                      {letter}
                    </text>
                    <text x={labelX} y={labelY + 10} fill="#ffffff" fontSize="11" textAnchor="middle">
                      {count}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface ChartBase {
  letter: string
  count: number
  gradientId: string
  baseColor: string
  gradient: ReturnType<typeof getGradientPalette>
}

interface ChartBar extends ChartBase {
  hasData: boolean
  barHeight: number
}

interface ChartSlice extends ChartBase {
  startFraction: number
  fraction: number
}
