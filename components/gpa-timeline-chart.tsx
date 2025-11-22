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
  const gradientSeed = useMemo(() => Math.random().toString(36).slice(2), [])
  const strokeGradientId = `gpa-stroke-${gradientSeed}`
  const uniqueColors = useMemo(() => Array.from(new Set((data || []).map((point) => point.color))), [data])
  const baseStrokeColor = uniqueColors[0] || "#38bdf8"
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
  const colorStops = useMemo(() => {
    if (!hasData || !data) return []
    if (data.length === 1) {
      return [
        { offset: 0, color: data[0].color },
        { offset: 100, color: data[0].color },
      ]
    }
    return data.map((point, index) => ({
      offset: (index / (data.length - 1)) * 100,
      color: point.color,
    }))
  }, [data, hasData])
  if (!hasData) return null

  const renderDot = (props: any) => {
    const { cx, cy, payload, index } = props
    const point = payload as TimelinePoint | undefined
    const color = point?.color ?? "#38bdf8"
    return <circle key={`dot-${point?.label ?? index}`} cx={cx} cy={cy} r={4} fill={color} stroke="#0f172a" strokeWidth={2} />
  }

  const renderActiveDot = (props: any) => {
    const { cx, cy, payload, index } = props
    const point = payload as TimelinePoint | undefined
    const color = point?.color ?? "#38bdf8"
    return (
      <circle key={`active-${point?.label ?? index}`} cx={cx} cy={cy} r={6} fill={color} stroke="#0f172a" strokeWidth={2} />
    )
  }

  return (
    <Card className="border-2 border-primary/20 shadow-xl">
      <CardHeader>
        <CardTitle className="text-xl text-primary">GPA Timeline</CardTitle>
      </CardHeader>
      <CardContent className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <defs>
              <linearGradient id={strokeGradientId} x1="0" y1="0" x2="1" y2="0">
                {colorStops.map(({ offset, color }) => (
                  <stop key={`stroke-${offset}-${color}`} offset={`${offset}%`} stopColor={color} />
                ))}
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="label"
              interval={0}
              height={80}
              tickMargin={12}
              tick={{ fill: "#9ca3af", angle: -90, textAnchor: "end" }}
            />
            <YAxis domain={paddedDomain} tick={{ fill: "#9ca3af" }} />
            <Tooltip
              contentStyle={{ backgroundColor: "rgba(15,15,15,0.9)", border: "1px solid rgba(255,255,255,0.1)" }}
              labelFormatter={(label, payload) => {
                const item = payload?.[0]?.payload as TimelinePoint | undefined
                return item ? `${item.label}` : label
              }}
              formatter={(value: number) => [`${value.toFixed(2)} GPA`, ""]}
            />
            <Line
              type="monotone"
              dataKey="gpa"
              stroke={colorStops.length > 1 && uniqueColors.length > 1 ? `url(#${strokeGradientId})` : baseStrokeColor}
              strokeOpacity={0.9}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              connectNulls
              dot={renderDot}
              activeDot={renderActiveDot}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
