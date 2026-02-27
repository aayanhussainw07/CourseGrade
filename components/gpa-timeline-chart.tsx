"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"

interface TimelinePoint {
  label: string
  color: string
  gpa: number
}

interface GpaTimelineChartProps {
  data: TimelinePoint[]
}

export function GpaTimelineChart({ data }: GpaTimelineChartProps) {
  const hasData = Array.isArray(data) && data.length > 0

  const minMax = useMemo(() => {
    if (!hasData) {
      return { min: 0, max: 4 }
    }

    const gpas = data.map((point) => point.gpa)
    const rawMin = Math.min(...gpas)
    const rawMax = Math.max(...gpas)

    return {
      min: Math.max(0, Math.floor(rawMin * 2) / 2),
      max: Math.min(4, Math.ceil(rawMax * 2) / 2),
    }
  }, [data, hasData])

  const paddedDomain = useMemo(() => {
    const lower = Math.max(0, minMax.min - 0.25)
    const upper = Math.min(4, minMax.max + 0.25)
    return [lower, Math.max(upper, lower + 0.5)]
  }, [minMax.max, minMax.min])

  if (!hasData) return null

  return (
    <Card className="border-2 border-primary/35 shadow-under-white-strong">
      <CardHeader>
        <CardTitle className="text-xl text-primary">GPA Timeline</CardTitle>
      </CardHeader>
      <CardContent className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="2 2" stroke="rgba(255,255,255,0.18)" />
            <XAxis dataKey="label" interval={0} height={60} tickMargin={10} tick={{ fill: "#d4d4d4", fontSize: 11 }} />
            <YAxis domain={paddedDomain} tick={{ fill: "#d4d4d4", fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(8,8,8,0.95)",
                border: "1px solid rgba(255,255,255,0.35)",
                color: "#f5f5f5",
              }}
              labelFormatter={(label, payload) => {
                const item = payload?.[0]?.payload as TimelinePoint | undefined
                return item ? item.label : label
              }}
              formatter={(value: number) => [`${value.toFixed(2)} GPA`, ""]}
            />
            <Line
              type="monotone"
              dataKey="gpa"
              stroke="#ffffff"
              strokeOpacity={0.95}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={{ r: 4, stroke: "#040404", strokeWidth: 2, fill: "#ffffff" }}
              activeDot={{ r: 6, stroke: "#040404", strokeWidth: 2, fill: "#ffffff" }}
              connectNulls
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
