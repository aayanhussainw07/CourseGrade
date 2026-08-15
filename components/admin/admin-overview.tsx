"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  CalendarDays,
  Coins,
  Cpu,
  Hash,
  Loader2,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type SeriesPoint = { date: string; count: number };
type AiPoint = { date: string; calls: number; cost: number };
type Stats = {
  observed_users: number;
  dau: number;
  wau: number;
  mau: number;
  first_seen_trend: SeriesPoint[];
  active_trend: SeriesPoint[];
  ai_total_calls: number;
  ai_total_cost: number;
  ai_total_tokens: number;
  ai_trend: AiPoint[];
  ai_by_model: { model: string; calls: number; cost: number }[];
};

const fmtUsd = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtCompact = (n: number) =>
  Intl.NumberFormat("en-US", { notation: "compact" }).format(n);

const fmtTick = (value: string) => {
  const d = new Date(`${value}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const STAT_CARDS: {
  key: keyof Stats;
  label: string;
  detail: string;
  icon: typeof Users;
}[] = [
  { key: "observed_users", label: "Observed Users", detail: "all time", icon: Users },
  { key: "dau", label: "Active Today", detail: "DAU", icon: Activity },
  { key: "wau", label: "Active 7d", detail: "WAU", icon: CalendarDays },
  { key: "mau", label: "Active 30d", detail: "MAU", icon: TrendingUp },
];

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative rounded-2xl border-2 border-primary/20 bg-[#fff8f1] p-4 sm:p-6">
      <div className="mb-4">
        <h3 className="font-futura-bold text-lg font-black uppercase tracking-wide text-foreground">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="h-64 w-full">{children}</div>
    </div>
  );
}

const RANGE_OPTIONS = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
  { days: 365, label: "1y" },
];

export function AdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState(30);

  const load = useCallback(async (rangeDays: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/stats?days=${rangeDays}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load stats.");
      setStats((await res.json()) as Stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stats.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(days);
  }, [load, days]);

  const rangeLabel = days >= 365 ? "last year" : `last ${days} days`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-destructive">{error || "No data."}</p>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => load(days)}
        >
          <RotateCcw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-lg border-2 border-primary/20 bg-[#fff8f1] p-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              type="button"
              onClick={() => setDays(opt.days)}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                days === opt.days
                  ? "bg-primary text-white"
                  : "text-foreground/70 hover:bg-primary/10"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 bg-[#fff8f1]"
          onClick={() => load(days)}
        >
          <RotateCcw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map(({ key, label, detail, icon: Icon }) => (
          <div
            key={key}
            className="relative flex flex-col rounded-md border-2 border-primary/25 bg-[#fff8f1] p-5 text-foreground"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {label}
              </p>
              <Icon className="h-4 w-4 text-primary/50" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <p className="text-4xl font-black leading-none text-primary">
                {(stats[key] as number).toLocaleString()}
              </p>
              <span className="text-xs font-semibold uppercase text-foreground/45">
                {detail}
              </span>
            </div>
          </div>
        ))}
      </div>

      <ChartCard
        title="First Seen"
        subtitle={`Users first observed by CourseGrade · ${rangeLabel}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={stats.first_seen_trend}
            margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
          >
            <defs>
              <linearGradient id="signupFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(198,90,78,0.12)" />
            <XAxis
              dataKey="date"
              tickFormatter={fmtTick}
              minTickGap={48}
              tick={{ fontSize: 11, fill: "rgba(77,31,26,0.55)" }}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "rgba(77,31,26,0.55)" }}
            />
            <Tooltip
              labelFormatter={fmtTick}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid rgba(198,90,78,0.3)",
                background: "#fff8f1",
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="count"
              name="First seen"
              stroke="var(--primary)"
              strokeWidth={2}
              fill="url(#signupFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Active Users"
        subtitle={`Distinct daily active users · ${rangeLabel}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={stats.active_trend}
            margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(198,90,78,0.12)" />
            <XAxis
              dataKey="date"
              tickFormatter={fmtTick}
              minTickGap={36}
              tick={{ fontSize: 11, fill: "rgba(77,31,26,0.55)" }}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "rgba(77,31,26,0.55)" }}
            />
            <Tooltip
              labelFormatter={fmtTick}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid rgba(198,90,78,0.3)",
                background: "#fff8f1",
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="count"
              name="Active users"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── AI usage ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 pt-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="font-futura-bold text-xl font-black uppercase tracking-wide text-foreground">
          AI Usage
        </h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "AI Calls",
            value: stats.ai_total_calls.toLocaleString(),
            detail: "all time",
            icon: Cpu,
          },
          {
            label: "AI Cost",
            value: fmtUsd(stats.ai_total_cost),
            detail: "estimated",
            icon: Coins,
          },
          {
            label: "Tokens",
            value: fmtCompact(stats.ai_total_tokens),
            detail: "in + out",
            icon: Hash,
          },
        ].map(({ label, value, detail, icon: Icon }) => (
          <div
            key={label}
            className="relative flex flex-col rounded-md border-2 border-primary/25 bg-[#fff8f1] p-5 text-foreground"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {label}
              </p>
              <Icon className="h-4 w-4 text-primary/50" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <p className="text-4xl font-black leading-none text-primary">
                {value}
              </p>
              <span className="text-xs font-semibold uppercase text-foreground/45">
                {detail}
              </span>
            </div>
          </div>
        ))}
      </div>

      <ChartCard
        title="AI Calls & Cost"
        subtitle={`Calls per day · ${rangeLabel}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={stats.ai_trend}
            margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(198,90,78,0.12)" />
            <XAxis
              dataKey="date"
              tickFormatter={fmtTick}
              minTickGap={36}
              tick={{ fontSize: 11, fill: "rgba(77,31,26,0.55)" }}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "rgba(77,31,26,0.55)" }}
            />
            <Tooltip
              labelFormatter={fmtTick}
              formatter={(value: number, name: string) =>
                name === "Cost" ? fmtUsd(value) : value
              }
              contentStyle={{
                borderRadius: 8,
                border: "1px solid rgba(198,90,78,0.3)",
                background: "#fff8f1",
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="calls"
              name="Calls"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="cost"
              name="Cost"
              stroke="rgba(77,31,26,0.45)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
