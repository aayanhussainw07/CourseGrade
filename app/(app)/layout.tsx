"use client";

import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { CourseCard } from "@/components/course-card";
import { CourseSidebar } from "@/components/course-sidebar";
import { SemesterPanel } from "@/components/semester-panel";
import { DashboardPanel } from "@/components/dashboard-panel";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Menu,
  Sparkles,
  Layers,
  Pencil,
  ChevronsUp,
  ChevronsDown,
} from "lucide-react";
import Image from "next/image";
import type { CoursePortableData } from "@/lib/csv";
import { AnimatePresence, motion } from "framer-motion";
import { signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SyllabusImportDialog } from "@/components/syllabus-import-dialog";
import { SettingsPage } from "@/components/settings-page";
import { loadAppSettings, loadAppSettingsFromServer, type AppSettings } from "@/lib/app-settings";
import { HIGHLIGHT_DURATION_MS, SCROLL_DELAY_MS } from "@/lib/constants";
import {
  readStoredDashboardMessage,
  writeStoredDashboardMessage,
} from "@/app/page-utils";
import { useSemesterData } from "@/hooks/useSemesterData";
import { FeedbackPanel } from "@/components/feedback-panel";
import { COURSE_ROSTER_ENABLED } from "@/lib/feature-flags";
import { AppTopBar } from "@/components/app-top-bar";
import { AppScreenLoader } from "@/components/app-screen-loader";

const SCREEN_TRANSITION_DURATION_MS = 300;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isSettingsView = pathname === "/settings";

  // ── Pure UI state ─────────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isScreenTransitioning, setIsScreenTransitioning] = useState(false);
  const previousScreenRef = useRef<string | null>(null);
  const screenTransitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [appSettings, setAppSettings] = useState<AppSettings>(loadAppSettings);
  const [syllabusImportOpen, setSyllabusImportOpen] = useState(false);
  const [editingSemesterNameId, setEditingSemesterNameId] = useState<
    string | null
  >(null);
  const [semesterNameDraft, setSemesterNameDraft] = useState("");
  const semesterNameEditCancelledRef = useRef(false);
  const [highlightedCourseId, setHighlightedCourseId] = useState<string | null>(
    null,
  );
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draggingMainCourseId, setDraggingMainCourseId] = useState<
    string | null
  >(null);
  const [dragOverMainCourseId, setDragOverMainCourseId] = useState<
    string | null
  >(null);
  const courseRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [dashboardMessage, setDashboardMessage] = useState("");
  const [dashboardMessageDraft, setDashboardMessageDraft] = useState("");
  const [isEditingQuote, setIsEditingQuote] = useState(false);

  // ── Data hook ─────────────────────────────────────────────────────────────
  const {
    session,
    status,
    semesters,
    activeSemesterId,
    setActiveSemesterId,
    loading,
    serverOffline,
    saveStatus,
    activeSemester,
    courses,
    isDashboardView,
    orderedSemesters,
    allCourses,
    overallGpa,
    overallGpaLetter,
    totalCredits,
    totalSemesters,
    semesterSummaries,
    timelineData,
    dashboardSummary,
    handleUndo,
    handleRedo,
    loadSemesters,
    addSemester,
    deleteSemester,
    editSemester,
    clearAllData,
    addCourse: createCourse,
    updateCourse,
    deleteCourse,
    importCourseFromSyllabus: importCourseFromSyllabusBase,
    collapseAllCourses,
    expandAllCourses,
    editCourse,
    handleReorderSemesters,
    handleReorderCourses,
    ignoredSemesterIds,
    toggleSemesterIgnore,
  } = useSemesterData({ appSettings });
  const screenKey = isSettingsView
    ? "settings"
    : activeSemesterId
      ? `semester:${activeSemesterId}`
      : "dashboard";

  useLayoutEffect(() => {
    if (status !== "authenticated" || loading) {
      previousScreenRef.current = screenKey;
      return;
    }

    if (previousScreenRef.current === null) {
      previousScreenRef.current = screenKey;
      return;
    }

    if (previousScreenRef.current === screenKey) return;

    previousScreenRef.current = screenKey;
    if (screenTransitionTimerRef.current) {
      clearTimeout(screenTransitionTimerRef.current);
    }

    setIsScreenTransitioning(true);
    screenTransitionTimerRef.current = setTimeout(() => {
      setIsScreenTransitioning(false);
      screenTransitionTimerRef.current = null;
    }, SCREEN_TRANSITION_DURATION_MS);
  }, [loading, screenKey, status]);

  useEffect(
    () => () => {
      if (screenTransitionTimerRef.current) {
        clearTimeout(screenTransitionTimerRef.current);
      }
    },
    [],
  );


  const startEditingSemesterName = useCallback(() => {
    if (!activeSemesterId) return;
    semesterNameEditCancelledRef.current = false;
    setSemesterNameDraft(activeSemester?.name ?? "");
    setEditingSemesterNameId(activeSemesterId);
  }, [activeSemester?.name, activeSemesterId]);

  const commitSemesterName = useCallback(() => {
    const semesterId = editingSemesterNameId;
    const nextName = semesterNameDraft.trim();
    const currentName = semesters.find(
      (semester) => semester.id === semesterId,
    )?.name;

    setEditingSemesterNameId(null);
    if (semesterId && nextName && nextName !== currentName) {
      void editSemester(semesterId, nextName);
    }
  }, [editSemester, editingSemesterNameId, semesterNameDraft, semesters]);

  const cancelSemesterNameEdit = useCallback(() => {
    semesterNameEditCancelledRef.current = true;
    setEditingSemesterNameId(null);
  }, []);

  // ── Dashboard message ─────────────────────────────────────────────────────
  const dashboardMessageScopeId = useMemo(
    () => session?.user?.id || session?.user?.email || "default",
    [session?.user?.id, session?.user?.email],
  );

  useEffect(() => {
    const stored = readStoredDashboardMessage(dashboardMessageScopeId);
    setDashboardMessage(stored);
    setDashboardMessageDraft(stored);
  }, [dashboardMessageScopeId]);

  const saveDashboardMessage = useCallback(() => {
    const value = dashboardMessageDraft.trim();
    writeStoredDashboardMessage(dashboardMessageScopeId, value);
    setDashboardMessage(value);
    setDashboardMessageDraft(value);
    setIsEditingQuote(false);
  }, [dashboardMessageDraft, dashboardMessageScopeId]);

  const clearDashboardMessage = useCallback(() => {
    writeStoredDashboardMessage(dashboardMessageScopeId, "");
    setDashboardMessage("");
    setDashboardMessageDraft("");
    setIsEditingQuote(false);
  }, [dashboardMessageScopeId]);

  // ── Load settings from server on auth ──────────────────────────────────────
  useEffect(() => {
    if (status === "authenticated") {
      loadAppSettingsFromServer().then(setAppSettings);
    }
  }, [status]);

  // ── Responsive sidebar ────────────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setSidebarOpen(false);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Scroll / highlight ────────────────────────────────────────────────────
  const scrollToCourse = useCallback((courseId: string) => {
    const element = courseRefs.current[courseId];
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlightedCourseId(courseId);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(
      () => setHighlightedCourseId(null),
      HIGHLIGHT_DURATION_MS,
    );
  }, []);

  // ── Scroll-dependent wrappers ─────────────────────────────────────────────
  const addCourse = useCallback(async () => {
    const course = await createCourse();
    if (course) setTimeout(() => scrollToCourse(course.id), SCROLL_DELAY_MS);
  }, [createCourse, scrollToCourse]);

  const importCourseFromSyllabus = useCallback(
    async (data: CoursePortableData, semesterId: string) => {
      const course = await importCourseFromSyllabusBase(data, semesterId);
      if (course) setTimeout(() => scrollToCourse(course.id), SCROLL_DELAY_MS);
    },
    [importCourseFromSyllabusBase, scrollToCourse],
  );

  // ── Early returns ─────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Image
            src="/coursegrade.png"
            alt="CourseGrade"
            width={48}
            height={48}
            className="mx-auto mb-4 h-12 w-12 animate-pulse"
          />
          <p className="text-muted-foreground">Checking your account...</p>
        </div>
      </div>
    );
  }

  if (serverOffline) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
        <Image
          src="/coursegrade.png"
          alt="CourseGrade"
          width={64}
          height={64}
          className="h-16 w-16"
        />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Server Offline</h1>
          <p className="mt-2 text-muted-foreground">
            We can't reach the grading server right now. Please try again
            shortly.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          <Button size="lg" onClick={() => loadSemesters()}>
            Retry
          </Button>
          <Button variant="ghost" size="lg" onClick={() => signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Image
            src="/coursegrade.png"
            alt="CourseGrade"
            width={48}
            height={48}
            className="mx-auto mb-4 h-12 w-12 animate-pulse"
          />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-nav-tone="light">
      <FeedbackPanel />
      <AppTopBar
        activeItem={
          isSettingsView ? "settings" : isDashboardView ? "dashboard" : null
        }
        onDashboard={() => {
          setActiveSemesterId(null);
          router.push("/dashboard");
        }}
        onSettings={() => router.push("/settings")}
      />

      {/* Mobile sidebar trigger */}
      <div className="fixed left-4 top-12 z-50 flex items-center gap-2 md:hidden">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button className="flex items-center gap-2 border border-border/70 bg-card/90 px-3 py-2 text-sm text-foreground hover:bg-card">
              <Menu className="h-4 w-4" />
              Overview
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="!bottom-0 !top-11 !h-auto w-[85vw] border-border/40 bg-background/95 p-0 text-foreground sm:w-96"
          >
            <SheetTitle className="sr-only">Course overview</SheetTitle>
            <SheetDescription className="sr-only">
              Navigate dashboards, semesters, courses, and account actions.
            </SheetDescription>
            <CourseSidebar
              variant="overlay"
              semesters={orderedSemesters}
              activeSemesterId={activeSemesterId}
              onSemesterClick={(id) => {
                setSidebarOpen(false);
                setActiveSemesterId(id);
                router.push("/semesters/" + id);
              }}
              onCourseClick={(id) => {
                setSidebarOpen(false);
                scrollToCourse(id);
              }}
              onAddSemester={addSemester}
              onDeleteSemester={deleteSemester}
              skipSemesterDeleteConfirm={appSettings.skipSemesterDeleteConfirm}
              skipCourseDeleteConfirm={appSettings.skipCourseDeleteConfirm}
              onEditSemester={editSemester}
              onDeleteCourse={deleteCourse}
              onEditCourse={editCourse}
              onReorderSemesters={handleReorderSemesters}
              onReorderCourses={handleReorderCourses}
              onToggleSemesterIgnore={toggleSemesterIgnore}
              ignoredSemesterIds={ignoredSemesterIds}
              userEmail={session?.user?.email ?? undefined}
              onSignOut={() => signOut()}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <CourseSidebar
        semesters={orderedSemesters}
        activeSemesterId={activeSemesterId}
        onSemesterClick={(id) => {
          setActiveSemesterId(id);
          router.push("/semesters/" + id);
        }}
        onCourseClick={scrollToCourse}
        onAddSemester={addSemester}
        onDeleteSemester={deleteSemester}
        skipSemesterDeleteConfirm={appSettings.skipSemesterDeleteConfirm}
        skipCourseDeleteConfirm={appSettings.skipCourseDeleteConfirm}
        onEditSemester={editSemester}
        onDeleteCourse={deleteCourse}
        onEditCourse={editCourse}
        onReorderSemesters={handleReorderSemesters}
        onReorderCourses={handleReorderCourses}
        onToggleSemesterIgnore={toggleSemesterIgnore}
        ignoredSemesterIds={ignoredSemesterIds}
        userEmail={session?.user?.email ?? undefined}
        onSignOut={() => signOut()}
        variant="desktop"
      />

      <div
        className="w-full px-4 py-8 transition-all duration-300 md:pl-[14rem] lg:pl-[17rem]"
        style={{ paddingRight: "1rem" }}
      >
        {isScreenTransitioning ? (
          <AppScreenLoader />
        ) : isSettingsView ? (
          <SettingsPage
            settings={appSettings}
            onSettingsChange={setAppSettings}
            onClearAllData={clearAllData}
            userEmail={session?.user?.email ?? undefined}
            userId={session?.user?.id ?? session?.user?.email ?? undefined}
          />
        ) : isDashboardView ? (
          <div className="-mx-4 -mt-8">
            <section
              data-nav-tone="dark"
              className="px-4 pb-4 pt-14 md:pb-6"
              style={{
                background: "#2d0008",
                backgroundImage:
                  "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 40px)",
              }}
            >
              <h1 className="sr-only">Dashboard</h1>

              <div className="mx-auto grid w-full max-w-[1500px] gap-4 md:gap-6 lg:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.65fr)] lg:items-stretch">
                <div className="relative min-h-[210px] rotate-[-1deg] rounded-md border border-[#e0c678] bg-[#fff0a8] p-5 text-foreground md:p-6">
                  <div className="absolute -top-3 left-1/2 h-7 w-28 -translate-x-1/2 rotate-2 border border-white/35 bg-white/45 backdrop-blur-[1px]" />
                  <div className="mb-4 flex items-center justify-between">
                    <p className="font-etna text-3xl leading-none text-primary">
                      QUOTE IT!
                    </p>
                    {dashboardMessage && !isEditingQuote && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-foreground/55 hover:bg-primary/10 hover:text-foreground"
                        onClick={() => setIsEditingQuote(true)}
                        title="Edit quote"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  {dashboardMessage && !isEditingQuote ? (
                    <p className="text-lg italic leading-relaxed text-foreground/90">
                      {dashboardMessage.length > 140
                        ? `"${dashboardMessage.slice(0, 140)}..."`
                        : `"${dashboardMessage}"`}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <textarea
                        value={dashboardMessageDraft}
                        onChange={(e) =>
                          setDashboardMessageDraft(e.target.value)
                        }
                        placeholder="Your motivational quote..."
                        rows={4}
                        maxLength={280}
                        className="w-full resize-none rounded-md border border-primary/25 bg-white/50 px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-foreground/45 focus:border-primary/45"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" onClick={saveDashboardMessage}>
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={clearDashboardMessage}
                          disabled={
                            dashboardMessage.length === 0 &&
                            dashboardMessageDraft.trim().length === 0
                          }
                        >
                          Clear
                        </Button>
                        {dashboardMessage && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setIsEditingQuote(false)}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-3 sm:grid-rows-2 md:gap-6">
                  {/* Hero stat — GPA dominates */}
                  <div className="relative flex flex-col rotate-[0.8deg] rounded-md border-2 border-primary/35 bg-[#fff8f1] p-5 text-foreground sm:col-span-2 sm:row-span-2 md:p-6">
                    <div className="absolute -top-2.5 left-7 h-6 w-24 rotate-[-3deg] bg-primary/25" />
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Overall GPA
                    </p>
                    <div className="mt-auto flex items-end gap-4">
                      <p className="text-7xl font-black leading-[0.85] text-primary sm:text-8xl">
                        {overallGpa.toFixed(2)}
                      </p>
                      <span className="mb-2 text-3xl font-bold uppercase text-foreground/55">
                        {overallGpaLetter}
                      </span>
                    </div>
                  </div>

                  {/* Secondary stats — demoted */}
                  {[
                    {
                      label: "Total Credits",
                      value: String(totalCredits),
                      detail: "credits",
                      rotate: "rotate-[-0.9deg]",
                    },
                    {
                      label: "Semesters",
                      value: String(totalSemesters),
                      detail: "tracked",
                      rotate: "rotate-[0.6deg]",
                    },
                  ].map(({ label, value, detail, rotate }) => (
                    <div
                      key={label}
                      className={`relative flex min-h-[80px] flex-col justify-center rounded-md border border-primary/20 bg-[#fff8f1] p-5 text-foreground md:p-6 ${rotate}`}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        {label}
                      </p>
                      <div className="mt-1.5 flex items-baseline gap-2">
                        <p className="text-3xl font-bold leading-none text-primary">
                          {value}
                        </p>
                        <span className="text-xs font-semibold uppercase text-foreground/45">
                          {detail}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section data-nav-tone="light" className="bg-background px-4 py-4 md:py-6">
              <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 md:gap-6">
                {semesters.length === 0 ? (
                  <div className="relative flex flex-col items-center justify-center gap-5 rounded-md border-2 border-dashed border-primary/25 bg-[#fff8f1] py-20 text-center">
                    <div className="absolute -top-3 left-1/2 h-6 w-24 -translate-x-1/2 rotate-2 bg-primary/15" />
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                      <Layers className="h-8 w-8 text-primary/60" />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-foreground">
                        No semesters yet
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Let's get started!
                      </p>
                    </div>
                    <Button onClick={addSemester} size="lg" className="gap-2">
                      <Plus className="h-5 w-5" />
                      Add Semester
                    </Button>
                  </div>
                ) : (
                  <>
                    <DashboardPanel
                      timelineData={timelineData}
                      courses={allCourses}
                    />

                    <div className="flex flex-col gap-4 md:gap-6">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                          Semesters
                        </h2>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3 2xl:grid-cols-4">
                        {semesterSummaries.map((summary, i) => {
                          const rotate =
                            i % 3 === 0
                              ? "rotate-[-0.8deg]"
                              : i % 3 === 1
                                ? "rotate-[0.7deg]"
                                : "rotate-[-0.2deg]";
                          return (
                            <div
                              key={summary.id}
                              className={`relative rounded-md bg-[#fff8f1] p-5 text-left ${rotate}`}
                            >
                              <div className="absolute -top-2 right-8 h-5 w-16 rotate-3 bg-primary/15" />
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <p className="truncate text-xl font-bold uppercase tracking-wide text-foreground">
                                    {summary.name}
                                  </p>
                                  <p className="mt-2 text-sm font-semibold text-muted-foreground">
                                    {summary.credits} credits
                                  </p>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="text-3xl font-black text-primary">
                                    {summary.gpa.toFixed(2)}
                                  </p>
                                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                    GPA
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>
          </div>
        ) : (
          <>
            {/* Dark header */}
            <div
              data-nav-tone="dark"
              className="-mx-4 -mt-8 pb-1 px-4 pt-14 pb-0"
              style={{
                background: "#2d0008",
                backgroundImage:
                  "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 40px)",
              }}
            >
              {/* Semester title */}
              <div className="mb-6 pl-7">
                {editingSemesterNameId === activeSemesterId ? (
                  <div className="flex min-w-0 items-center justify-start">
                    <input
                      autoFocus
                      aria-label="Semester name"
                      size={Math.max(1, semesterNameDraft.length)}
                      value={semesterNameDraft}
                      onChange={(e) => setSemesterNameDraft(e.target.value)}
                      onFocus={(e) => e.currentTarget.select()}
                      onBlur={() => {
                        if (semesterNameEditCancelledRef.current) {
                          semesterNameEditCancelledRef.current = false;
                          return;
                        }
                        commitSemesterName();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.currentTarget.blur();
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          cancelSemesterNameEdit();
                        }
                      }}
                      className="font-futura-bold min-w-[1ch] max-w-full border-0 bg-transparent p-0 text-left text-5xl uppercase text-white outline-none [field-sizing:content]"
                    />
                  </div>
                ) : (
                  <div className="flex min-w-0 items-center justify-start">
                    <button
                      type="button"
                      aria-label="Edit semester name"
                      className="font-futura-bold max-w-full cursor-text truncate border-0 bg-transparent p-0 text-left text-5xl uppercase text-white"
                      onClick={startEditingSemesterName}
                    >
                      {activeSemester?.name ?? "Semester"}
                    </button>
                  </div>
                )}
              </div>

              {/* Semester summary */}
              {courses.length > 0 && (
                <div className="pb-8 px-2">
                  <SemesterPanel courses={courses} />
                </div>
              )}
            </div>

            {/* Add / Import */}
            {activeSemesterId && (
              <>
                <div data-nav-tone="dark" className="-mx-4 -mt-px flex flex-wrap items-center justify-center gap-3 bg-primary px-4 py-5 print:hidden">
                  {courses.length > 0 && (
                    <>
                      <Button
                        onClick={collapseAllCourses}
                        size="icon"
                        variant="ghost"
                        className="h-10 w-10 border border-white/70 bg-white text-[#7b0707] hover:bg-white/70 hover:text-[#7b0707]"
                        title="Compress all courses"
                      >
                        <ChevronsUp className="h-5 w-5" />
                      </Button>
                      <Button
                        onClick={expandAllCourses}
                        size="icon"
                        variant="ghost"
                        className="h-10 w-10 border border-white/70 bg-white text-[#7b0707] hover:bg-white/70 hover:text-[#7b0707]"
                        title="Expand all courses"
                      >
                        <ChevronsDown className="h-5 w-5" />
                      </Button>
                    </>
                  )}
                  <Button
                    onClick={addCourse}
                    size="lg"
                    variant="ghost"
                    className="gap-2 border border-white/70 bg-white text-[#7b0707] hover:bg-white/70 hover:text-[#7b0707]"
                  >
                    <Plus className="h-5 w-5" />
                    Add Course
                  </Button>
                  <Button
                    onClick={() => setSyllabusImportOpen(true)}
                    size="lg"
                    variant="ghost"
                    className="gap-2 border border-white/70 bg-white text-[#7b0707] hover:bg-white/70 hover:text-[#7b0707]"
                  >
                    <Sparkles className="h-5 w-5" />
                    Import Syllabus
                  </Button>
                </div>
              </>
            )}

            {/* Course cards */}
            {activeSemesterId && (
              <div className="space-y-4 mt-8">
                <AnimatePresence initial={false}>
                  {courses.map((course, i) => (
                    <motion.div
                      key={course.id}
                      ref={(el) => {
                        courseRefs.current[course.id] = el;
                      }}
                      initial={{ y: 60 }}
                      animate={{ y: 0 }}
                      exit={{
                        opacity: 0,
                        transition: { duration: 0.12 },
                      }}
                      transition={{
                        duration: 0.2,
                        ease: "easeOut",
                        delay: Math.min(i, 10) * 0.035,
                      }}
                    >
                      <div
                        draggable
                        onDragStart={(e) => {
                          setDraggingMainCourseId(course.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragOver={(e) => {
                          if (
                            !draggingMainCourseId ||
                            draggingMainCourseId === course.id
                          )
                            return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          setDragOverMainCourseId(course.id);
                        }}
                        onDragLeave={(e) => {
                          if (
                            !e.currentTarget.contains(e.relatedTarget as Node)
                          ) {
                            setDragOverMainCourseId(null);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (
                            !draggingMainCourseId ||
                            draggingMainCourseId === course.id ||
                            !activeSemesterId
                          )
                            return;
                          const courseIds = courses.map((c) => c.id);
                          const fromIndex =
                            courseIds.indexOf(draggingMainCourseId);
                          const toIndex = courseIds.indexOf(course.id);
                          if (fromIndex !== -1 && toIndex !== -1) {
                            const updated = [...courseIds];
                            const [moved] = updated.splice(fromIndex, 1);
                            updated.splice(toIndex, 0, moved);
                            handleReorderCourses(activeSemesterId, updated);
                          }
                          setDraggingMainCourseId(null);
                          setDragOverMainCourseId(null);
                        }}
                        onDragEnd={() => {
                          setDraggingMainCourseId(null);
                          setDragOverMainCourseId(null);
                        }}
                        style={{
                          opacity: draggingMainCourseId === course.id ? 0.4 : 1,
                          outline:
                            dragOverMainCourseId === course.id
                              ? "2px solid var(--primary)"
                              : undefined,
                          borderRadius:
                            dragOverMainCourseId === course.id
                              ? "12px"
                              : undefined,
                          cursor: draggingMainCourseId ? "grabbing" : "grab",
                        }}
                      >
                        <CourseCard
                          course={course}
                          highlighted={highlightedCourseId === course.id}
                          cornellMode={
                            COURSE_ROSTER_ENABLED &&
                            appSettings.school === "cornell"
                          }
                          onUpdate={(courseId, nextCourse) =>
                            updateCourse(courseId, nextCourse)
                          }
                          onDelete={deleteCourse}
                          skipDeleteConfirm={appSettings.skipCourseDeleteConfirm}
                        />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {activeSemesterId && courses.length === 0 && (
              <div className="mt-12 text-center">
                <p className="text-muted-foreground">
                  No courses in this semester. Click "Add Course" to get
                  started!
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {activeSemesterId && (
        <SyllabusImportDialog
          open={syllabusImportOpen}
          onOpenChange={setSyllabusImportOpen}
          semesterId={activeSemesterId}
          semesterName={
            semesters.find((s) => s.id === activeSemesterId)?.name ?? "Semester"
          }
          onImport={importCourseFromSyllabus}
        />
      )}

      <div className="hidden">{children}</div>
    </div>
  );
}
