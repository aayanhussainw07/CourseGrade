"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { calculateCourseGrade, getLetterGrade, getLetterGradeColor } from "@/lib/grade-utils"
import type { Course } from "@/lib/types"
import { motion } from "framer-motion"
import { BarChart3, PieChart } from "lucide-react"
import { useState } from "react"

interface GradeDistributionChartProps {
  courses: Course[]
}

export function GradeDistributionChart({ courses }: GradeDistributionChartProps) {
  const [chartType, setChartType] = useState<"bar" | "pie">("bar")

  // Calculate grade distribution
  const distribution: Record<string, number> = {}

  for (const course of courses) {
    const numericGrade = calculateCourseGrade(course.criteria)
    const letterGrade = getLetterGrade(numericGrade, course.gradeScale)
    distribution[letterGrade] = (distribution[letterGrade] || 0) + 1
  }

  const grades = Object.entries(distribution).sort((a, b) => {
    const order = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F"]
    return order.indexOf(a[0]) - order.indexOf(b[0])
  })

  const maxCount = Math.max(...Object.values(distribution))

  if (courses.length === 0) {
    return null
  }

  const total = grades.reduce((sum, [, count]) => sum + count, 0)
  let cumulativePercentage = 0

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl text-primary">Grade Distribution</CardTitle>
          <div className="flex gap-1">
            <Button
              variant={chartType === "bar" ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setChartType("bar")}
              title="Bar chart"
            >
              <BarChart3 className="h-4 w-4" />
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
      <CardContent>
        {chartType === "bar" ? (
          <div className="space-y-3">
            {grades.map(([letter, count]) => {
              const percentage = (count / courses.length) * 100
              const color = getLetterGradeColor(letter)

              return (
                <div key={letter} className="flex items-center gap-3">
                  <div className="w-12 text-right font-bold" style={{ color }}>
                    {letter}
                  </div>
                  <div className="flex-1">
                    <div className="relative h-8 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(count / maxCount) * 100}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    </div>
                  </div>
                  <div className="w-16 text-sm text-muted-foreground">
                    {count} ({percentage.toFixed(0)}%)
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <svg viewBox="0 0 200 200" className="w-48 h-48">
              {grades.map(([letter, count]) => {
                const percentage = (count / total) * 100
                const angle = (percentage / 100) * 360
                const startAngle = (cumulativePercentage / 100) * 360
                const endAngle = startAngle + angle

                const startRad = ((startAngle - 90) * Math.PI) / 180
                const endRad = ((endAngle - 90) * Math.PI) / 180

                const x1 = 100 + 90 * Math.cos(startRad)
                const y1 = 100 + 90 * Math.sin(startRad)
                const x2 = 100 + 90 * Math.cos(endRad)
                const y2 = 100 + 90 * Math.sin(endRad)

                const largeArc = angle > 180 ? 1 : 0

                const path = `M 100 100 L ${x1} ${y1} A 90 90 0 ${largeArc} 1 ${x2} ${y2} Z`

                const color = getLetterGradeColor(letter)
                const result = (cumulativePercentage += percentage)

                return (
                  <motion.path
                    key={letter}
                    d={path}
                    fill={color}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: grades.indexOf([letter, count]) * 0.1 }}
                  />
                )
              })}
            </svg>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 w-full">
              {grades.map(([letter, count]) => {
                const percentage = (count / courses.length) * 100
                const color = getLetterGradeColor(letter)

                return (
                  <div key={letter} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />
                    <span className="text-sm font-medium" style={{ color }}>
                      {letter}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {count} ({percentage.toFixed(0)}%)
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
