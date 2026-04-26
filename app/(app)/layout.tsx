"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { CourseCard } from "@/components/course-card";
import { CourseSidebar } from "@/components/course-sidebar";
import { SemesterPanel } from "@/components/semester-panel";
import { DashboardPanel } from "@/components/dashboard-panel";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Menu,
  Upload,
  Sparkles,
  Download,
  TrendingUp,
  Layers,
  Pencil,
  Printer,
  ChevronsUp,
  ChevronsDown,
  Share2,
  Check,
  Settings,
} from "lucide-react";
import Image from "next/image";
import type { CoursePortableData } from "@/lib/csv";
import { AnimatePresence, motion } from "framer-motion";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SyllabusImportDialog } from "@/components/syllabus-import-dialog";
import { SettingsDialog } from "@/components/settings-dialog";
import { loadAppSettings, type AppSettings } from "@/lib/app-settings";
import { HIGHLIGHT_DURATION_MS, SCROLL_DELAY_MS } from "@/lib/constants";
import {
  readStoredDashboardMessage,
  writeStoredDashboardMessage,
} from "@/app/page-utils";
import { useSemesterData } from "@/hooks/useSemesterData";
import { useShareUrl } from "@/hooks/useShareUrl";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  // ── Pure UI state ─────────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(loadAppSettings);
  const [syllabusImportOpen, setSyllabusImportOpen] = useState(false);
  const [isEditingSemesterName, setIsEditingSemesterName] = useState(false);
  const [semesterNameDraft, setSemesterNameDraft] = useState("");
  const [highlightedCourseId, setHighlightedCourseId] = useState<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draggingMainCourseId, setDraggingMainCourseId] = useState<string | null>(null);
  const [dragOverMainCourseId, setDragOverMainCourseId] = useState<string | null>(null);
  const courseRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const dashboardFileInputRef = useRef<HTMLInputElement | null>(null);
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
    duplicateSemester,
    addCourse: createCourse,
    updateCourse,
    deleteCourse,
    duplicateCourse: duplicateCourseBase,
    importCourseFromSyllabus: importCourseFromSyllabusBase,
    collapseAllCourses,
    expandAllCourses,
    editCourse,
    handleReorderSemesters,
    handleReorderCourses,
    importSemesterFromJson,
    importCourseFromJson,
    importDashboardBackup,
    exportSemesterToJson,
    exportCourseToJson,
    exportDashboardBackup,
  } = useSemesterData({ appSettings });

  const { shareUrl, shareCopied, generateShareUrl, closeShareUrl, copyShareUrl } = useShareUrl({
    semesters,
    activeSemesterId,
  });

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

  // ── Responsive sidebar ────────────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 1024) setSidebarOpen(false); };
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

  const duplicateCourse = useCallback(
    async (courseId: string) => {
      const course = await duplicateCourseBase(courseId);
      if (course) setTimeout(() => scrollToCourse(course.id), SCROLL_DELAY_MS);
    },
    [duplicateCourseBase, scrollToCourse],
  );

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
        <Image src="/coursegrade.png" alt="CourseGrade" width={64} height={64} className="h-16 w-16" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Server Offline</h1>
          <p className="mt-2 text-muted-foreground">
            We can't reach the grading server right now. Please try again shortly.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          <Button size="lg" onClick={() => loadSemesters()}>Retry</Button>
          <Button variant="ghost" size="lg" onClick={() => signOut()}>Sign out</Button>
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
    <div className="min-h-screen bg-background">
      {/* Top-right actions */}
      <div className="fixed right-4 top-4 z-50 flex items-center gap-2">
        {activeSemesterId && (
          <Button
            onClick={() => setSyllabusImportOpen(true)}
            className="flex items-center gap-2 border border-white/10 bg-foreground px-3 py-2 text-sm text-white hover:bg-foreground/80 shadow-none"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 40px)",
            }}
          >
            <Sparkles className="h-4 w-4" />
            Import Syllabus
          </Button>
        )}
        <Button
          size="icon"
          onClick={() => setSettingsOpen(true)}
          className="border border-white/10 bg-foreground text-white hover:bg-foreground/80 h-9 w-9 shadow-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 40px)",
          }}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* Mobile sidebar trigger */}
      <div className="fixed left-4 top-6 z-50 md:hidden">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button className="flex items-center gap-2 border border-border/70 bg-card/90 px-3 py-2 text-sm text-foreground shadow-under-white hover:bg-card">
              <Menu className="h-4 w-4" />
              Overview
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[85vw] border-border/40 bg-background/95 p-0 text-foreground sm:w-96"
          >
            <CourseSidebar
              variant="overlay"
              semesters={orderedSemesters}
              activeSemesterId={activeSemesterId}
              onSemesterClick={(id) => {
                setSidebarOpen(false);
                setActiveSemesterId(id);
                router.push("/semesters/" + id);
              }}
              onCourseClick={(id) => { setSidebarOpen(false); scrollToCourse(id); }}
              onAddSemester={addSemester}
              onDeleteSemester={deleteSemester}
              skipSemesterDeleteConfirm={appSettings.skipSemesterDeleteConfirm}
              onEditSemester={editSemester}
              onDeleteCourse={deleteCourse}
              onEditCourse={editCourse}
              onImportSemester={importSemesterFromJson}
              onReorderSemesters={handleReorderSemesters}
              onReorderCourses={handleReorderCourses}
              dashboardSummary={totalSemesters ? dashboardSummary : undefined}
              onDashboardClick={() => {
                setSidebarOpen(false);
                setActiveSemesterId(null);
                router.push("/dashboard");
              }}
              isDashboardActive={isDashboardView}
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
        onEditSemester={editSemester}
        onDeleteCourse={deleteCourse}
        onEditCourse={editCourse}
        onImportSemester={importSemesterFromJson}
        onReorderSemesters={handleReorderSemesters}
        onReorderCourses={handleReorderCourses}
        onDuplicateSemester={duplicateSemester}
        dashboardSummary={totalSemesters ? dashboardSummary : undefined}
        onDashboardClick={() => {
          setActiveSemesterId(null);
          router.push("/dashboard");
        }}
        isDashboardActive={isDashboardView}
        userEmail={session?.user?.email ?? undefined}
        onSignOut={() => signOut()}
        variant="desktop"
      />

      <SettingsDialog
        open={settingsOpen}
        onClose={() => { setSettingsOpen(false); setAppSettings(loadAppSettings()); }}
        onClearAllData={clearAllData}
        userEmail={session?.user?.email ?? undefined}
        userId={session?.user?.id ?? session?.user?.email ?? undefined}
      />

      <div
        className="w-full px-4 py-8 transition-all duration-300 md:pl-[14rem] lg:pl-[17rem]"
        style={{ paddingRight: "1rem" }}
      >
        {isDashboardView ? (
          <div className="space-y-6">
            <p className="w-fit mx-auto text-2xl font-bold uppercase tracking-widest bg-primary text-white px-8 py-2 [box-shadow:5px_5px_0_rgba(77,31,26,0.55),10px_10px_0_rgba(77,31,26,0.25)]">
              Dashboard
            </p>

            {/* Quote widget */}
            <div className="w-full rounded-lg border border-primary/35 bg-card/85 shadow-under-white-soft overflow-hidden flex">
              <div className="relative flex shrink-0 items-center justify-center bg-primary border-r border-primary/20 px-5 py-4 overflow-hidden">
                <p className="relative font-etna text-2xl text-white leading-none">quote.</p>
              </div>
              <div className="flex-1 px-5 py-4">
                {dashboardMessage && !isEditingQuote ? (
                  <div className="group relative h-full flex items-center">
                    <p className="text-lg italic text-foreground/90">
                      {dashboardMessage.length > 100
                        ? `"${dashboardMessage.slice(0, 100)}…"`
                        : `"${dashboardMessage}"`}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => setIsEditingQuote(true)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <textarea
                      value={dashboardMessageDraft}
                      onChange={(e) => setDashboardMessageDraft(e.target.value)}
                      placeholder="Your motivational quote..."
                      rows={2}
                      maxLength={280}
                      className="w-full resize-none rounded-md border border-primary/25 bg-background/90 px-3 py-1.5 text-sm text-foreground outline-none transition focus:border-primary/45"
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <Button size="sm" onClick={saveDashboardMessage}>Save</Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={clearDashboardMessage}
                        disabled={
                          dashboardMessage.length === 0 && dashboardMessageDraft.trim().length === 0
                        }
                      >
                        Clear
                      </Button>
                      {dashboardMessage && (
                        <Button size="sm" variant="ghost" onClick={() => setIsEditingQuote(false)}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {semesters.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-5 rounded-xl border-2 border-dashed border-primary/20 bg-card/40 py-20 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Layers className="h-8 w-8 text-primary/60" />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">No semesters yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Let's get started!</p>
                </div>
                <Button onClick={addSemester} size="lg" className="gap-2">
                  <Plus className="h-5 w-5" />
                  Add Semester
                </Button>
              </div>
            ) : (
              <>
                <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 2fr 1fr" }}>
                  {[
                    { label: "Total Credits", content: <p className="mt-2 text-5xl font-bold text-white">{totalCredits}</p> },
                    { label: "Overall GPA", content: <div className="mt-1 flex items-center justify-between pr-8"><p className="flex items-baseline gap-2 text-4xl font-bold text-white"><TrendingUp className="h-5 w-5 text-white/60" />{overallGpa.toFixed(2)}</p><span className="text-7xl font-black text-white/80">{overallGpaLetter}</span></div> },
                    { label: "Semesters Tracked", content: <p className="mt-2 text-5xl font-bold text-white">{totalSemesters}</p> },
                  ].map(({ label, content }) => (
                    <div
                      key={label}
                      className="relative overflow-hidden rounded-lg bg-primary p-4 text-left"
                      style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 20px), repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 20px)" }}
                    >
                      <p className="text-sm font-medium text-white/60 uppercase tracking-widest">{label}</p>
                      {content}
                    </div>
                  ))}
                </div>

                <DashboardPanel timelineData={timelineData} courses={allCourses} />

                <div className="grid p-4 pb-0 gap-4 lg:grid">
                  {semesterSummaries.map((summary, i) => {
                    const skew = i % 2 === 0 ? -2 : 2;
                    return (
                      <div
                        key={summary.id}
                        className="relative overflow-hidden p-5 text-left"
                        style={{ backgroundColor: "color-mix(in srgb, var(--primary) 75%, black)" }}
                      >
                        <div
                          className="flex items-center justify-between"
                          style={{ transform: `skewX(${-skew}deg)` }}
                        >
                          <p className="text-xl font-bold text-white uppercase tracking-wide">{summary.name}</p>
                          <span className="text-2xl font-black text-white">{summary.gpa.toFixed(2)} GPA</span>
                        </div>
                        <p className="mt-1 text-sm text-white/60" style={{ transform: `skewX(${-skew}deg)` }}>
                          Credits: {summary.credits}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end gap-2 mr-5 ml-5">
                  <input
                    ref={dashboardFileInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) importDashboardBackup(file);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-secondary/40 bg-transparent hover:bg-primary hover:text-white hover:border-primary"
                    onClick={() => dashboardFileInputRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Import
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-secondary/40 bg-transparent hover:bg-primary hover:text-white hover:border-primary"
                    onClick={exportDashboardBackup}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Dark header */}
            <div
              className="-mx-4 -mt-8 px-4 pt-8 pb-0"
              style={{
                background: "#2d0008",
                backgroundImage:
                  "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 40px)",
              }}
            >
              {/* Semester title */}
              <div className="mb-6">
                {isEditingSemesterName ? (
                  <div className="flex items-center justify-center gap-2">
                    <input
                      autoFocus
                      value={semesterNameDraft}
                      onChange={(e) => setSemesterNameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && semesterNameDraft.trim() && activeSemesterId) {
                          editSemester(activeSemesterId, semesterNameDraft.trim());
                          setIsEditingSemesterName(false);
                        } else if (e.key === "Escape") {
                          setIsEditingSemesterName(false);
                        }
                      }}
                      className="rounded-md border border-primary/35 bg-background/90 px-3 py-1 text-2xl font-semibold text-foreground outline-none focus:border-primary/60"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        if (semesterNameDraft.trim() && activeSemesterId) {
                          editSemester(activeSemesterId, semesterNameDraft.trim());
                        }
                        setIsEditingSemesterName(false);
                      }}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white/70 hover:text-white hover:bg-white/10"
                      onClick={() => setIsEditingSemesterName(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <div className="group relative">
                      <p className="w-fit text-5xl font-bold uppercase tracking-widest text-white">
                        {activeSemester?.name ?? "Semester"}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-1/2 -translate-y-1/2 left-full ml-4 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 text-white/60 hover:text-white hover:bg-white/10"
                        title="Edit name"
                        onClick={() => {
                          setSemesterNameDraft(activeSemester?.name ?? "");
                          setIsEditingSemesterName(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              {courses.length > 0 && (
                <div className="mb-4 flex flex-wrap items-center justify-center gap-1.5 print:hidden">
                  <Button
                    size="icon"
                    onClick={collapseAllCourses}
                    className="h-8 w-8 bg-primary/80 text-white hover:bg-primary border-0 shadow-none"
                    title="Collapse All"
                  >
                    <ChevronsUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    onClick={expandAllCourses}
                    className="h-8 w-8 bg-primary/80 text-white hover:bg-primary border-0 shadow-none"
                    title="Expand All"
                  >
                    <ChevronsDown className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    onClick={() => window.print()}
                    className="h-8 w-8 bg-primary/80 text-white hover:bg-primary border-0 shadow-none"
                    title="Print"
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                  <div className="relative">
                    <Button
                      size="icon"
                      onClick={() => (shareUrl ? closeShareUrl() : generateShareUrl())}
                      className="h-8 w-8 bg-primary/80 text-white hover:bg-primary border-0 shadow-none"
                      title="Share"
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                    {shareUrl && (
                      <div className="absolute left-0 top-full z-50 mt-2 w-80 rounded-lg border border-border bg-card p-3 shadow-lg">
                        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                          Share link (read-only)
                        </p>
                        <div className="flex items-center gap-2">
                          <input
                            readOnly
                            value={shareUrl}
                            className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-xs outline-none"
                            onFocus={(e) => e.target.select()}
                          />
                          <Button
                            size="sm"
                            className="h-7 shrink-0 gap-1 px-2 text-xs"
                            onClick={copyShareUrl}
                          >
                            {shareCopied ? <Check className="h-3 w-3" /> : <Share2 className="h-3 w-3" />}
                            {shareCopied ? "Copied!" : "Copy"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Semester summary */}
              {courses.length > 0 && (
                <div className="pb-8 px-2">
                  <SemesterPanel courses={courses} />
                </div>
              )}
            </div>

            {/* Course cards */}
            {activeSemesterId && (
              <AnimatePresence mode="popLayout">
                <div className="space-y-6 mt-8">
                  {courses.map((course, index) => (
                    <motion.div
                      key={`${course.id}-${index}`}
                      ref={(el) => { courseRefs.current[course.id] = el; }}
                      initial={{ opacity: 0, scale: 0.95, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{
                        opacity: 0,
                        scale: 0.85,
                        y: -20,
                        transition: { duration: 0.25, ease: "easeInOut" },
                      }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    >
                      <div
                        draggable
                        onDragStart={(e) => {
                          setDraggingMainCourseId(course.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragOver={(e) => {
                          if (!draggingMainCourseId || draggingMainCourseId === course.id) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          setDragOverMainCourseId(course.id);
                        }}
                        onDragLeave={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                            setDragOverMainCourseId(null);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (!draggingMainCourseId || draggingMainCourseId === course.id || !activeSemesterId) return;
                          const courseIds = courses.map((c) => c.id);
                          const fromIndex = courseIds.indexOf(draggingMainCourseId);
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
                          borderRadius: dragOverMainCourseId === course.id ? "12px" : undefined,
                          cursor: draggingMainCourseId ? "grabbing" : "grab",
                        }}
                      >
                        <CourseCard
                          course={course}
                          highlighted={highlightedCourseId === course.id}
                          onUpdate={(courseId, nextCourse) => updateCourse(courseId, nextCourse)}
                          onDelete={deleteCourse}
                          onExportCourse={exportCourseToJson}
                          onDuplicate={() => duplicateCourse(course.id)}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </AnimatePresence>
            )}

            {/* Add / Import / Export */}
            {activeSemesterId && (
              <>
                <input
                  id="course-import-trigger"
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) importCourseFromJson(file, activeSemesterId);
                    e.target.value = "";
                  }}
                />
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Button
                    onClick={addCourse}
                    size="lg"
                    variant="outline"
                    className="gap-2 border-secondary/40 bg-transparent hover:bg-primary hover:text-white hover:border-primary"
                  >
                    <Plus className="h-5 w-5" />
                    Add Course
                  </Button>
                  <Button
                    onClick={() => document.getElementById("course-import-trigger")?.click()}
                    size="lg"
                    variant="outline"
                    className="gap-2 border-secondary/40 bg-transparent hover:bg-primary hover:text-white hover:border-primary"
                  >
                    <Upload className="h-5 w-5" />
                    Import Course
                  </Button>
                  <Button
                    onClick={() => exportSemesterToJson(activeSemesterId)}
                    size="lg"
                    variant="outline"
                    className="gap-2 border-secondary/40 bg-transparent hover:bg-primary hover:text-white hover:border-primary"
                  >
                    <Download className="h-5 w-5" />
                    Export Semester
                  </Button>
                </div>
              </>
            )}

            {activeSemesterId && courses.length === 0 && (
              <div className="mt-12 text-center">
                <p className="text-muted-foreground">
                  No courses in this semester. Click "Add Course" to get started!
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
          semesterName={semesters.find((s) => s.id === activeSemesterId)?.name ?? "Semester"}
          onImport={importCourseFromSyllabus}
        />
      )}

      <div className="hidden">{children}</div>
    </div>
  );
}
