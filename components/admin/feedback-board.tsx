"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Check,
  ClipboardCheck,
  Loader2,
  RotateCcw,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type FeedbackEntry = {
  id: number;
  user_id: string;
  rating: number;
  comment: string;
  completed: boolean;
  created_at: string;
};

const Tape = ({ className = "" }: { className?: string }) => (
  <span
    aria-hidden="true"
    className={`pointer-events-none absolute h-5 w-24 bg-primary/15 ${className}`}
  />
);

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export function FeedbackBoard() {
  const { status } = useSession();
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());

  const sortedEntries = useMemo(
    () =>
      [...entries].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }),
    [entries],
  );

  const activeCount = entries.filter((entry) => !entry.completed).length;
  const completedCount = entries.length - activeCount;
  const avgRating =
    entries.length > 0
      ? (
          entries.reduce((sum, entry) => sum + entry.rating, 0) / entries.length
        ).toFixed(1)
      : "--";

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError("");
    setForbidden(false);
    try {
      const res = await fetch("/api/feedback/items");
      if (res.status === 401 || res.status === 403) {
        setForbidden(true);
        setEntries([]);
        return;
      }
      if (!res.ok) throw new Error("Failed to load feedback.");
      const data = (await res.json()) as FeedbackEntry[];
      setEntries(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load feedback.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (status !== "authenticated") {
      setForbidden(true);
      setLoading(false);
      return;
    }
    loadEntries();
  }, [loadEntries, status]);

  const setBusy = (id: number, busy: boolean) => {
    setBusyIds((current) => {
      const next = new Set(current);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleCompleted = async (entry: FeedbackEntry) => {
    const nextCompleted = !entry.completed;
    setBusy(entry.id, true);
    setError("");
    setEntries((current) =>
      current.map((item) =>
        item.id === entry.id ? { ...item, completed: nextCompleted } : item,
      ),
    );
    try {
      const res = await fetch(`/api/feedback/items/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: nextCompleted }),
      });
      if (!res.ok) throw new Error("Failed to update feedback.");
      const updated = (await res.json()) as FeedbackEntry;
      setEntries((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (err) {
      setEntries((current) =>
        current.map((item) =>
          item.id === entry.id ? { ...item, completed: entry.completed } : item,
        ),
      );
      setError(
        err instanceof Error ? err.message : "Failed to update feedback.",
      );
    } finally {
      setBusy(entry.id, false);
    }
  };

  const deleteEntry = async (entry: FeedbackEntry) => {
    const previousEntries = entries;
    setBusy(entry.id, true);
    setError("");
    setEntries((current) => current.filter((item) => item.id !== entry.id));
    try {
      const res = await fetch(`/api/feedback/items/${entry.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete feedback.");
    } catch (err) {
      setEntries(previousEntries);
      setError(
        err instanceof Error ? err.message : "Failed to delete feedback.",
      );
    } finally {
      setBusy(entry.id, false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Feedback is only available to CourseGrade admins.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Open", activeCount.toString()],
          ["Done", completedCount.toString()],
          ["Avg", `${avgRating} stars`],
        ].map(([label, value]) => (
          <div
            key={label}
            className="relative rounded-lg border border-primary/25 bg-[#fff8f1] px-5 py-4 text-foreground"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 text-2xl font-black text-primary">{value}</p>
          </div>
        ))}
      </div>

      <div className="relative rounded-2xl border-2 border-primary/20 bg-[#fff8f1] p-4 sm:p-6">
        <Tape className="-top-3 left-10 rotate-[-2deg]" />
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-sm border border-primary/20 bg-primary/10 text-primary">
              <ClipboardCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-futura-bold text-xl font-black uppercase tracking-wide">
                Feedback Board
              </h2>
              <p className="text-sm text-muted-foreground">
                Checked items automatically move below open feedback.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-[#fff8f1]"
            onClick={loadEntries}
          >
            <RotateCcw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {error && (
          <div className="relative mb-5 rounded-lg border-2 border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {sortedEntries.length === 0 && !error && (
          <div className="relative rounded-xl border-2 border-dashed border-primary/20 bg-white/45 px-6 py-12 text-center">
            <p className="font-semibold text-foreground">No feedback yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              New submissions will show up here as checklist notes.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {sortedEntries.map((entry) => {
            const busy = busyIds.has(entry.id);
            return (
              <article
                key={entry.id}
                className={`relative rounded-xl border-2 bg-white/60 p-4 transition-all sm:p-5 ${
                  entry.completed
                    ? "border-primary/10 opacity-60"
                    : "border-primary/25"
                }`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 ${
                              star <= entry.rating
                                ? "fill-primary text-primary"
                                : "fill-transparent text-primary/25"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="rounded-sm border border-primary/15 bg-[#fff8f1] px-2 py-1 text-xs font-semibold text-muted-foreground">
                        {entry.user_id}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(entry.created_at)}
                      </span>
                    </div>
                    <p
                      className={`whitespace-pre-wrap text-sm leading-6 ${
                        entry.completed
                          ? "text-muted-foreground line-through decoration-primary/40"
                          : "text-foreground"
                      }`}
                    >
                      {entry.comment || "No written comment."}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={entry.completed ? "outline" : "default"}
                      disabled={busy}
                      className="gap-2"
                      onClick={() => toggleCompleted(entry)}
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : entry.completed ? (
                        <RotateCcw className="h-4 w-4" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      {entry.completed ? "Reopen" : "Done"}
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      disabled={busy}
                      className="h-9 w-9"
                      onClick={() => deleteEntry(entry)}
                      title="Delete feedback"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
