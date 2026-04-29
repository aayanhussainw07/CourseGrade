"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { calculateCourseGrade, getLetterGrade } from "@/lib/grade-utils";
import type { Course } from "@/lib/types";
import { BarChart3, PieChart } from "lucide-react";
import { useMemo, useState } from "react";

interface GradeDistributionChartProps {
  courses: Course[];
  title?: string;
}

const GRADE_ORDER = [
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "C-",
  "D+",
  "D",
  "D-",
  "F",
];

const CHART_COLORS: Record<string, string> = {
  "A+": "#e8756a",
  A: "#d9645a",
  "A-": "#c5534a",
  "B+": "#e8a068",
  B: "#d98e58",
  "B-": "#c57e4a",
  "C+": "#d9c058",
  C: "#c8ae48",
  "C-": "#b59a3a",
  "D+": "#9898d0",
  D: "#8484be",
  "D-": "#7070ac",
  F: "#8a8a8a",
};

interface ChartEntry {
  letter: string;
  count: number;
  color: string;
  pct: number;
}

export function GradeDistributionChart({
  courses,
  title = "Grade Distribution",
}: GradeDistributionChartProps) {
  const [chartType, setChartType] = useState<"bar" | "pie">("bar");

  const data = useMemo((): ChartEntry[] => {
    if (!courses.length) return [];
    const dist: Record<string, number> = {};
    for (const course of courses) {
      const numeric = calculateCourseGrade(
        course.criteria,
        course.percentBoost,
      );
      const letter = getLetterGrade(numeric, course.gradeScale);
      dist[letter] = (dist[letter] || 0) + 1;
    }
    const total = Object.values(dist).reduce((s, v) => s + v, 0);
    if (!total) return [];
    return GRADE_ORDER.filter((l) => dist[l]).map((letter) => ({
      letter,
      count: dist[letter],
      color: CHART_COLORS[letter] ?? "#888",
      pct: Math.round((dist[letter] / total) * 100),
    }));
  }, [courses]);

  if (!data.length) return null;

  const total = data.reduce((s, d) => s + d.count, 0);
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <Card className="border-2 border-primary/35 shadow-under-white-strong">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-primary">{title}</CardTitle>
          <div className="flex gap-1">
            <Button
              variant={chartType === "bar" ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              type="button"
              onClick={() => setChartType("bar")}
              title="Bar chart"
            >
              <BarChart3 className="h-5 w-4" />
            </Button>
            <Button
              variant={chartType === "pie" ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              type="button"
              onClick={() => setChartType("pie")}
              title="Donut chart"
            >
              <PieChart className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        {chartType === "bar" ? (
          <BarView data={data} maxCount={maxCount} />
        ) : (
          <DonutView data={data} total={total} />
        )}
      </CardContent>
    </Card>
  );
}

function BarView({ data, maxCount }: { data: ChartEntry[]; maxCount: number }) {
  return (
    <div
      className="flex items-end gap-1.5 px-1 pt-2"
      style={{ height: "160px" }}
    >
      {data.map(({ letter, count, color, pct }) => {
        const heightPct = Math.max(10, (count / maxCount) * 78);
        return (
          <div key={letter} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] font-medium text-muted-foreground">
              {pct}%
            </span>
            <div className="flex w-full flex-1 flex-col justify-end">
              <div
                className="w-full rounded-t-lg transition-all duration-500"
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: color,
                  boxShadow: `0 -3px 10px ${color}66`,
                }}
              >
                <span className="flex w-full justify-center pt-1.5 text-[11px] font-bold text-white/90 drop-shadow">
                  {count}
                </span>
              </div>
            </div>
            <div className="h-px w-full bg-border/50" />
            <span className="text-[11px] font-semibold text-foreground">
              {letter}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DonutView({ data, total }: { data: ChartEntry[]; total: number }) {
  const SIZE = 200;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const outerR = 92;
  const innerR = 56;
  const GAP = 1.8;

  function arc(cx: number, cy: number, r: number, deg: number) {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  let cum = 0;
  const slices = data.map((entry) => {
    const start = cum;
    cum += entry.count / total;
    return { ...entry, start, fraction: entry.count / total };
  });

  function slicePath(start: number, fraction: number) {
    const startDeg = start * 360 + GAP / 2;
    const endDeg = (start + fraction) * 360 - GAP / 2;
    const large = endDeg - startDeg > 180 ? 1 : 0;
    const p1 = arc(cx, cy, outerR, startDeg);
    const p2 = arc(cx, cy, outerR, endDeg);
    const p3 = arc(cx, cy, innerR, endDeg);
    const p4 = arc(cx, cy, innerR, startDeg);
    return [
      `M ${p1.x} ${p1.y}`,
      `A ${outerR} ${outerR} 0 ${large} 1 ${p2.x} ${p2.y}`,
      `L ${p3.x} ${p3.y}`,
      `A ${innerR} ${innerR} 0 ${large} 0 ${p4.x} ${p4.y}`,
      "Z",
    ].join(" ");
  }

  const labelR = (outerR + innerR) / 2;
  const singleSlice = slices.length === 1 ? slices[0] : null;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="155" height="155">
        {slices.map((s) => {
          const midDeg = (s.start + s.fraction / 2) * 360;
          const lp = arc(cx, cy, labelR, midDeg);
          const showLabel = s.fraction >= 1 || s.fraction > 0.07;

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
            );
          }

          return (
            <g key={s.letter} className="cursor-pointer">
              <path
                d={slicePath(s.start, s.fraction)}
                fill={s.color}
                className="transition-opacity hover:opacity-75"
              />
              {showLabel && (
                <>
                  <text
                    x={lp.x}
                    y={lp.y - 4}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="700"
                    fill="#fff"
                    style={{ pointerEvents: "none" }}
                  >
                    {s.letter}
                  </text>
                  <text
                    x={lp.x}
                    y={lp.y + 9}
                    textAnchor="middle"
                    fontSize="9"
                    fill="#fff"
                    opacity="0.85"
                    style={{ pointerEvents: "none" }}
                  >
                    {s.pct}%
                  </text>
                </>
              )}
            </g>
          );
        })}
        {singleSlice ? (
          <>
            <text
              x={cx}
              y={cy - 12}
              textAnchor="middle"
              fontSize="22"
              fontWeight="800"
              fill="var(--foreground)"
            >
              {singleSlice.letter}
            </text>
            <text
              x={cx}
              y={cy + 5}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill="var(--muted-foreground)"
            >
              {singleSlice.pct}%
            </text>
            <text
              x={cx}
              y={cy + 20}
              textAnchor="middle"
              fontSize="8"
              letterSpacing="1.2"
              fill="var(--muted-foreground)"
            >
              {total} {total === 1 ? "COURSE" : "COURSES"}
            </text>
          </>
        ) : (
          <>
            <text
              x={cx}
              y={cy - 7}
              textAnchor="middle"
              fontSize="22"
              fontWeight="700"
              fill="var(--foreground)"
            >
              {total}
            </text>
            <text
              x={cx}
              y={cy + 11}
              textAnchor="middle"
              fontSize="9"
              letterSpacing="1.5"
              fill="var(--muted-foreground)"
            >
              COURSES
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
