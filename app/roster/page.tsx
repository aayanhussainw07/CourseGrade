"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Search, Loader2, ChevronDown, ArrowLeft, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { loadAppSettings } from "@/lib/app-settings";
import { storage } from "@/lib/storage";
import { getRandomHeaderColor } from "@/lib/header-colors";
import { getSubjectChip } from "@/lib/subject-colors";

type Subject = { code: string; descr: string | null };
// One offering of a course in a specific term.
type Term = {
  roster: string;
  roster_descr: string | null;
  year: number;
  term: string;
  title_long: string | null;
  credits_min: number | null;
  credits_max: number | null;
  instructors: string[];
  description: string | null;
  prereqs: string | null;
  distr_reqs: string | null;
};
// A course merged across every term it was offered.
type Course = {
  code_norm: string;
  subject: string;
  catalog_nbr: string;
  title_long: string | null;
  credits_min: number | null;
  credits_max: number | null;
  offered_count: number;
  terms: Term[];
};

const PAGE_SIZE = 40;

// Sidebar filter options.
const SEMESTERS: { code: string; label: string }[] = [
  { code: "FA", label: "Fall" },
  { code: "SP", label: "Spring" },
  { code: "SU", label: "Summer" },
  { code: "WI", label: "Winter" },
];
const LEVELS: { value: number; label: string }[] = [
  { value: 1000, label: "1000" },
  { value: 2000, label: "2000" },
  { value: 3000, label: "3000" },
  { value: 4000, label: "4000" },
  { value: 5000, label: "5000+" },
];

function creditLabel(min: number | null, max: number | null): string {
  if (min == null && max == null) return "— cr";
  if (min != null && max != null && min !== max) return `${min}–${max} cr`;
  return `${min ?? max} cr`;
}

function CheckRow({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-sm text-foreground transition-colors hover:bg-primary/5"
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
          checked
            ? "border-primary bg-primary text-white"
            : "border-input bg-card"
        }`}
      >
        {checked && <Check className="h-3 w-3" />}
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export default function RosterPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedTerms, setSelectedTerms] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<number[]>([]);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [searchInput, setSearchInput] = useState<string>("");
  const [q, setQ] = useState<string>("");

  const [courses, setCourses] = useState<Course[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [subjectsError, setSubjectsError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const reqId = useRef(0);
  const [cornellMode, setCornellMode] = useState(true);

  // ── Add-to-semester (courses with no syllabus available) ───────────────────
  const [userSemesters, setUserSemesters] = useState<
    { id: string; name: string }[]
  >([]);
  const [pickerKey, setPickerKey] = useState<string | null>(null);
  const [addState, setAddState] = useState<
    Record<string, { status: "adding" | "added"; semesterName?: string }>
  >({});

  // ── Auth gate ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/");
  }, [status, router]);

  // ── School gate (Cornell-only feature) ─────────────────────────────────────
  useEffect(() => {
    setCornellMode(loadAppSettings().school === "cornell");
  }, []);

  // ── Load the user's semesters for the add-to-semester picker ───────────────
  useEffect(() => {
    if (status !== "authenticated") return;
    storage.setUserScope(session?.user?.id || session?.user?.email || "default");
    storage
      .getSemesters()
      .then((sems) => setUserSemesters(sems.map((s) => ({ id: s.id, name: s.name }))))
      .catch(() => setUserSemesters([]));
  }, [status, session?.user?.id, session?.user?.email]);

  const addCourseToSemester = useCallback(
    async (
      key: string,
      semesterId: string,
      semesterName: string,
      title: string,
      credits: number,
    ) => {
      setAddState((p) => ({ ...p, [key]: { status: "adding" } }));
      setPickerKey(null);
      try {
        await storage.createCourse(
          semesterId,
          title,
          credits,
          getRandomHeaderColor(),
        );
        setAddState((p) => ({
          ...p,
          [key]: { status: "added", semesterName },
        }));
      } catch {
        setAddState((p) => {
          const next = { ...p };
          delete next[key];
          return next;
        });
      }
    },
    [],
  );

  // ── Debounce search box -> q ───────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ── Load the full subject list once for the sidebar ────────────────────────
  const loadSubjects = useCallback(async () => {
    setSubjectsError("");
    try {
      const response = await fetch("/api/roster/filters");
      const data = (await response.json().catch(() => null)) as
        | { subjects?: unknown; detail?: string }
        | null;
      if (!response.ok) {
        throw new Error(data?.detail || "Could not load subjects.");
      }
      if (!Array.isArray(data?.subjects)) {
        throw new Error("The subject response was invalid.");
      }
      setSubjects(data.subjects as Subject[]);
    } catch (error) {
      setSubjects([]);
      setSubjectsError(
        error instanceof Error ? error.message : "Could not load subjects.",
      );
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") void loadSubjects();
  }, [status, loadSubjects]);

  // ── Fetch courses (reset to page 0 on any filter change) ───────────────────
  const fetchPage = useCallback(
    async (targetPage: number, replace: boolean) => {
      const id = ++reqId.current;
      replace ? setLoading(true) : setLoadingMore(true);
      setLoadError("");
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          pageSize: String(PAGE_SIZE),
        });
        selectedTerms.forEach((t) => params.append("term", t));
        selectedSubjects.forEach((s) => params.append("subject", s));
        selectedLevels.forEach((l) => params.append("level", String(l)));
        if (q) params.set("q", q);
        const res = await fetch(`/api/roster?${params.toString()}`);
        const data = (await res.json().catch(() => null)) as
          | {
              courses?: unknown;
              total?: number;
              page?: number;
              hasMore?: boolean;
              detail?: string;
            }
          | null;
        if (id !== reqId.current) return; // stale response
        if (!res.ok) throw new Error(data?.detail || "Could not load courses.");
        if (!Array.isArray(data?.courses)) {
          throw new Error("The course response was invalid.");
        }
        const courseRows = data.courses as Course[];
        setCourses((prev) =>
          replace ? courseRows : [...prev, ...courseRows],
        );
        setTotal(data.total ?? 0);
        setPage(data.page ?? targetPage);
        setHasMore(Boolean(data.hasMore));
      } catch (error) {
        if (id === reqId.current) {
          setLoadError(
            error instanceof Error ? error.message : "Could not load courses.",
          );
          if (replace) {
            setCourses([]);
            setTotal(0);
            setHasMore(false);
          }
        }
      } finally {
        if (id === reqId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [selectedTerms, selectedSubjects, selectedLevels, q],
  );

  useEffect(() => {
    setExpanded(new Set());
    fetchPage(0, true);
  }, [fetchPage]);

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const headerTermLabel = useMemo(() => {
    if (selectedTerms.length === 0) return "All semesters";
    return selectedTerms
      .map((t) => SEMESTERS.find((s) => s.code === t)?.label ?? t)
      .join(", ");
  }, [selectedTerms]);

  const visibleSubjects = useMemo(() => {
    const needle = subjectFilter.trim().toLowerCase();
    if (!needle) return subjects;
    return subjects.filter(
      (s) =>
        s.code.toLowerCase().includes(needle) ||
        (s.descr ?? "").toLowerCase().includes(needle),
    );
  }, [subjects, subjectFilter]);

  const toggleIn = <T,>(arr: T[], v: T): T[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!cornellMode) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <p className="text-lg font-semibold text-foreground">
          Course Roster is a Cornell feature
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Enable <span className="font-semibold">Cornell mode</span> in Settings
          to browse the course roster.
        </p>
        <Link href="/dashboard">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Dark header banner — matches dashboard */}
      <div
        className="px-4 pb-8 pt-8"
        style={{
          background: "#2d0008",
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 40px)",
        }}
      >
        <div className="mx-auto w-full max-w-[1400px]">
          <div className="mb-5 flex items-center gap-3">
            <Link href="/dashboard">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/80 hover:bg-transparent hover:text-white"
                title="Back to dashboard"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Image
              src="/coursegrade.png"
              alt="CourseGrade"
              width={28}
              height={28}
              className="h-7 w-7"
            />
          </div>
          <h1 className="font-futura-bold text-4xl uppercase text-white sm:text-5xl">
            Cornell Course Roster
          </h1>
          <p className="mt-2 text-sm text-white/55">
            {headerTermLabel}
            {total > 0 && ` · ${total.toLocaleString()} results`}
          </p>
        </div>
      </div>

      {/* Body: filter sidebar + results */}
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-6 lg:flex-row">
        {/* Filter sidebar */}
        <aside className="shrink-0 lg:w-56">
          <div className="space-y-6 lg:sticky lg:top-4">
            <h2 className="font-futura-bold text-2xl uppercase text-foreground">
              Filter
            </h2>

            <FilterSection title="Semester">
              {SEMESTERS.map((s) => (
                <CheckRow
                  key={s.code}
                  label={s.label}
                  checked={selectedTerms.includes(s.code)}
                  onToggle={() =>
                    setSelectedTerms((p) => toggleIn(p, s.code))
                  }
                />
              ))}
            </FilterSection>

            <FilterSection title="Level">
              {LEVELS.map((l) => (
                <CheckRow
                  key={l.value}
                  label={l.label}
                  checked={selectedLevels.includes(l.value)}
                  onToggle={() =>
                    setSelectedLevels((p) => toggleIn(p, l.value))
                  }
                />
              ))}
            </FilterSection>

            <FilterSection title="Subject">
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                  placeholder="Find subject…"
                  className="h-9 pl-8 text-sm"
                />
              </div>
              <div className="max-h-72 overflow-y-auto pr-1">
                {visibleSubjects.map((s) => (
                  <CheckRow
                    key={s.code}
                    label={s.descr ? `${s.code} — ${s.descr}` : s.code}
                    checked={selectedSubjects.includes(s.code)}
                    onToggle={() =>
                      setSelectedSubjects((p) => toggleIn(p, s.code))
                    }
                  />
                ))}
                {visibleSubjects.length === 0 && (
                  <p className="px-1 py-2 text-xs text-muted-foreground">
                    No subjects match.
                  </p>
                )}
              </div>
              {subjectsError && (
                <div className="mt-2 space-y-1 px-1 text-xs text-destructive">
                  <p>{subjectsError}</p>
                  <button
                    type="button"
                    className="font-semibold underline underline-offset-2"
                    onClick={() => void loadSubjects()}
                  >
                    Retry
                  </button>
                </div>
              )}
            </FilterSection>
          </div>
        </aside>

        {/* Results column */}
        <main className="min-w-0 flex-1">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by course code or title…"
              className="pl-9"
            />
          </div>
        {loadError && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <p>{loadError}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchPage(0, true)}
            >
              Retry
            </Button>
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : loadError && courses.length === 0 ? null : courses.length === 0 ? (
          <div className="rounded-md border-2 border-dashed border-primary/20 bg-[#fff8f1] py-20 text-center text-muted-foreground">
            No courses match your filters.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 items-start gap-3">
              {courses.map((c) => {
                const key = c.code_norm;
                const isOpen = expanded.has(key);
                const terms = c.terms ?? [];
                const latest = terms[0];
                const earliest = terms[terms.length - 1];
                const termRange =
                  terms.length === 0
                    ? ""
                    : terms.length === 1
                      ? latest.roster
                      : `${earliest.roster} – ${latest.roster}`;
                const chip = getSubjectChip(c.subject);
                return (
                  <div
                    key={key}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isOpen}
                    onClick={() => toggle(key)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggle(key);
                      }
                    }}
                    className={`block w-full cursor-pointer overflow-hidden rounded-md border bg-[#fff8f1] p-4 text-left text-foreground transition-[outline] outline-none ${
                      isOpen
                        ? "border-primary outline outline-2 outline-primary/70"
                        : "border-primary/25 hover:border-primary/45"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span
                        className={`-mt-4 -ml-4 flex shrink-0 items-center self-stretch rounded-tl-md px-4 text-base font-black uppercase tracking-tight text-white ${
                          isOpen ? "" : "-mb-4 rounded-bl-md"
                        }`}
                        style={{ backgroundColor: chip.fg }}
                      >
                        {c.subject} {c.catalog_nbr}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-semibold text-foreground">
                        {c.title_long ?? "Untitled course"}
                      </span>
                      <span className="hidden shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:block">
                        {termRange}
                      </span>
                      <span className="shrink-0 text-sm font-bold uppercase tracking-wide text-primary">
                        {creditLabel(c.credits_min, c.credits_max)}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-primary/60 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </div>

                    {isOpen && (
                      <div className="mt-3 space-y-4 border-t border-primary/15 pt-3 text-sm">
                        {/* Most-recent description (varies by term) */}
                        {latest?.description && (
                          <p className="leading-relaxed text-foreground/80">
                            {latest.description}
                          </p>
                        )}

                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Offered in — pick the term you took
                          </p>
                          {terms.map((t) => {
                            const termKey = `${c.code_norm}::${t.roster}`;
                            const profs = t.instructors?.length
                              ? t.instructors.slice(0, 3).join(", ") +
                                (t.instructors.length > 3
                                  ? ` +${t.instructors.length - 3}`
                                  : "")
                              : "Staff / TBA";
                            const title =
                              t.title_long ?? `${c.subject} ${c.catalog_nbr}`;
                            const credits =
                              typeof t.credits_min === "number"
                                ? t.credits_min
                                : 0;
                            const st = addState[termKey];
                            return (
                              <div
                                key={termKey}
                                onClick={(e) => e.stopPropagation()}
                                className="rounded-md border border-primary/15 bg-[#fffdfb] p-3"
                              >
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                  <span className="font-semibold text-foreground">
                                    {t.roster_descr ?? t.roster}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {profs}
                                  </span>
                                  <span className="ml-auto text-xs font-bold uppercase tracking-wide text-primary">
                                    {creditLabel(t.credits_min, t.credits_max)}
                                  </span>
                                </div>

                                <div className="mt-2">
                                  {st?.status === "added" ? (
                                    <p className="text-xs font-semibold text-primary">
                                      ✓ Added to {st.semesterName}
                                    </p>
                                  ) : pickerKey === termKey ? (
                                    userSemesters.length === 0 ? (
                                      <p className="text-xs text-muted-foreground">
                                        No semesters yet —{" "}
                                        <Link
                                          href="/dashboard"
                                          className="font-semibold text-primary hover:underline"
                                        >
                                          create one on the dashboard
                                        </Link>
                                        .
                                      </p>
                                    ) : (
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-xs text-muted-foreground">
                                          Add to:
                                        </span>
                                        {userSemesters.map((s) => (
                                          <button
                                            key={s.id}
                                            type="button"
                                            disabled={st?.status === "adding"}
                                            onClick={() =>
                                              addCourseToSemester(
                                                termKey,
                                                s.id,
                                                s.name,
                                                title,
                                                credits,
                                              )
                                            }
                                            className="rounded-md border border-primary/30 bg-[#fff8f1] px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                                          >
                                            {s.name}
                                          </button>
                                        ))}
                                        <button
                                          type="button"
                                          onClick={() => setPickerKey(null)}
                                          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                                        >
                                          cancel
                                        </button>
                                      </div>
                                    )
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={st?.status === "adding"}
                                      onClick={() => setPickerKey(termKey)}
                                      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary/80 underline-offset-2 transition-colors hover:text-primary hover:underline disabled:opacity-50"
                                    >
                                      {st?.status === "adding" && (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      )}
                                      Add this term to a semester
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {hasMore && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => fetchPage(page + 1, false)}
                  disabled={loadingMore}
                  className="gap-2"
                >
                  {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
        </main>
      </div>
    </div>
  );
}
