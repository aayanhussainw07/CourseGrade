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
import {
  type Course,
  type Criterion,
  type Semester,
  type SubItem,
} from "@/lib/types";
import { storage, ApiUnavailableError } from "@/lib/storage";
import {
  serializeCourseCsv,
  serializeSemesterCsv,
  parseCourseCsv,
  parseSemesterCsv,
  type CoursePortableData,
} from "@/lib/csv";
import { AnimatePresence, motion } from "framer-motion";
import { useSession, signOut } from "next-auth/react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  applyStoredSettingsToSemesters,
  persistCourseSettings,
  removeCourseSettings,
} from "@/lib/course-settings";
import { calculateGPA } from "@/lib/grade-utils";
import {
  ACTIVE_SEMESTER_STORAGE_KEY,
  DASHBOARD_SENTINEL,
  type DashboardBackupPayload,
  type Snapshot,
  courseToPortable,
  deepCopy,
  formatDateLabel,
  generateClientId,
  getGpaColor,
  isServerResourceId,
  parseSemesterSortValue,
  readStoredDashboardMessage,
  readStoredSemesterOrder,
  safeFilename,
  sanitizeSemesters,
  triggerFileDownload,
  writeStoredDashboardMessage,
  writeStoredSemesterOrder,
} from "@/app/page-utils";
import { usePathname, useRouter } from "next/navigation";
import { SyllabusImportDialog } from "@/components/syllabus-import-dialog";

import { SettingsDialog } from "@/components/settings-dialog";
import { loadAppSettings, type AppSettings } from "@/lib/app-settings";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Derive initial semester ID from URL
  const routeSemesterId = useMemo(() => {
    if (pathname === "/dashboard") return null;
    const match = pathname.match(/^\/semesters\/(.+)$/);
    return match ? match[1] : undefined;
  }, [pathname]);

  // -------------------------------
  // STATE VARIABLES
  // -------------------------------

  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [semesterOrder, setSemesterOrder] = useState<string[]>([]);
  const [activeSemesterId, setActiveSemesterId] = useState<string | null>(null);
  const courseRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const dashboardFileInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverOffline, setServerOffline] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const historyRef = useRef<{
    past: Snapshot[];
    future: Snapshot[];
    lastSerialized: string;
  }>({ past: [], future: [], lastSerialized: "" });
  const skipHistoryRef = useRef(false);
  const snapshotDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const { data: session, status } = useSession();
  const [dashboardMessage, setDashboardMessage] = useState("");
  const [dashboardMessageDraft, setDashboardMessageDraft] = useState("");
  const [isEditingQuote, setIsEditingQuote] = useState(false);
  const [syllabusImportOpen, setSyllabusImportOpen] = useState(false);

  const [isEditingSemesterName, setIsEditingSemesterName] = useState(false);
  const [semesterNameDraft, setSemesterNameDraft] = useState("");
  const [highlightedCourseId, setHighlightedCourseId] = useState<string | null>(
    null,
  );
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [draggingMainCourseId, setDraggingMainCourseId] = useState<
    string | null
  >(null);
  const [dragOverMainCourseId, setDragOverMainCourseId] = useState<
    string | null
  >(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(loadAppSettings);
  const dashboardMessageScopeId = useMemo(
    () => session?.user?.id || session?.user?.email || "default",
    [session?.user?.id, session?.user?.email],
  );

  useEffect(() => {
    setSemesterOrder((previous) => {
      if (semesters.length === 0) {
        return [];
      }
      const semesterIds = semesters.map((semester) => semester.id);
      const filtered = previous.filter((id) => semesterIds.includes(id));
      const missing = semesterIds.filter((id) => !filtered.includes(id));
      if (missing.length === 0 && filtered.length === previous.length) {
        return previous;
      }
      return [...filtered, ...missing];
    });
  }, [semesters]);

  useEffect(() => {
    if (semesterOrder.length === 0) return;
    writeStoredSemesterOrder(semesterOrder);
  }, [semesterOrder]);

  const activeSemester = useMemo(
    () => semesters.find((semester) => semester.id === activeSemesterId),
    [semesters, activeSemesterId],
  );
  const courses = activeSemester?.courses || [];
  const isDashboardView = activeSemesterId === null;

  const captureSnapshot = useCallback((): Snapshot => {
    return {
      semesters: deepCopy(sanitizeSemesters(semesters, semesters)),
      semesterOrder: [...semesterOrder],
      activeSemesterId,
    };
  }, [semesters, semesterOrder, activeSemesterId]);

  const applySnapshot = useCallback((snapshot: Snapshot) => {
    skipHistoryRef.current = true;
    setSemesters((current) => {
      const sanitized = sanitizeSemesters(snapshot.semesters, current);
      return deepCopy(sanitized);
    });
    setSemesterOrder([...snapshot.semesterOrder]);
    setActiveSemesterId((currentActive) => {
      if (currentActive && snapshot.semesterOrder.includes(currentActive)) {
        return currentActive;
      }
      const fallbackId = snapshot.activeSemesterId;
      if (fallbackId && snapshot.semesterOrder.includes(fallbackId)) {
        return fallbackId;
      }
      return null;
    });
  }, []);

  const pushSnapshotIfChanged = useCallback((snapshot: Snapshot) => {
    const serialized = JSON.stringify(snapshot);
    if (!historyRef.current.lastSerialized) {
      historyRef.current.past = [snapshot];
      historyRef.current.lastSerialized = serialized;
      historyRef.current.future = [];
      return;
    }
    if (skipHistoryRef.current) {
      skipHistoryRef.current = false;
      historyRef.current.lastSerialized = serialized;
      return;
    }
    if (serialized !== historyRef.current.lastSerialized) {
      historyRef.current.past.push(snapshot);
      if (historyRef.current.past.length > 50) {
        historyRef.current.past.shift();
      }
      historyRef.current.future = [];
      historyRef.current.lastSerialized = serialized;
    }
  }, []);

  const handleUndo = useCallback(() => {
    if (historyRef.current.past.length <= 1) return;
    const current = historyRef.current.past.pop();
    if (!current) return;
    historyRef.current.future.unshift(current);
    const previous =
      historyRef.current.past[historyRef.current.past.length - 1];
    if (previous) {
      applySnapshot(previous);
      historyRef.current.lastSerialized = JSON.stringify(previous);
    }
  }, [applySnapshot]);

  const handleRedo = useCallback(() => {
    if (historyRef.current.future.length === 0) return;
    const next = historyRef.current.future.shift();
    if (!next) return;
    historyRef.current.past.push(next);
    applySnapshot(next);
    historyRef.current.lastSerialized = JSON.stringify(next);
  }, [applySnapshot]);

  const orderedSemesters = useMemo(() => {
    if (semesterOrder.length === 0) {
      return [...semesters].sort(
        (a, b) => parseSemesterSortValue(a) - parseSemesterSortValue(b),
      );
    }
    const semesterMap = new Map(
      semesters.map((semester) => [semester.id, semester]),
    );
    const ordered = semesterOrder
      .map((id) => semesterMap.get(id))
      .filter((semester): semester is Semester => Boolean(semester));
    if (ordered.length === semesters.length) {
      return ordered;
    }
    const missing = semesters.filter(
      (semester) => !semesterOrder.includes(semester.id),
    );
    return [...ordered, ...missing];
  }, [semesterOrder, semesters]);

  const allCourses = useMemo(
    () =>
      orderedSemesters.flatMap((semester) =>
        Array.isArray(semester.courses) ? semester.courses : [],
      ),
    [orderedSemesters],
  );
  const overallGpa = useMemo(
    () =>
      allCourses.length > 0
        ? calculateGPA(allCourses, appSettings.aPlusGpaValue)
        : 0,
    [allCourses, appSettings.aPlusGpaValue],
  );

  const overallGpaLetter = useMemo(() => {
    const scale = [
      { letter: "A+", pts: appSettings.aPlusGpaValue },
      { letter: "A",  pts: 4.0 },
      { letter: "A-", pts: 3.7 },
      { letter: "B+", pts: 3.3 },
      { letter: "B",  pts: 3.0 },
      { letter: "B-", pts: 2.7 },
      { letter: "C+", pts: 2.3 },
      { letter: "C",  pts: 2.0 },
      { letter: "C-", pts: 1.7 },
      { letter: "D+", pts: 1.3 },
      { letter: "D",  pts: 1.0 },
      { letter: "D-", pts: 0.7 },
      { letter: "F",  pts: 0.0 },
    ];
    for (const { letter, pts } of scale) {
      if (overallGpa >= pts) return letter;
    }
    return "F";
  }, [overallGpa, appSettings.aPlusGpaValue]);
  const totalCredits = useMemo(
    () => allCourses.reduce((sum, course) => sum + course.credits, 0),
    [allCourses],
  );
  const totalSemesters = orderedSemesters.length;

  const semesterSummaries = useMemo(
    () =>
      orderedSemesters.map((semester) => {
        const coursesList = Array.isArray(semester.courses)
          ? semester.courses
          : [];
        const credits = coursesList.reduce(
          (sum, course) => sum + course.credits,
          0,
        );
        const gpa =
          coursesList.length > 0
            ? calculateGPA(coursesList, appSettings.aPlusGpaValue)
            : 0;
        return {
          id: semester.id,
          name: semester.name,
          gpa,
          credits,
          createdAt: semester.createdAt ?? semester.updatedAt ?? "",
        };
      }),
    [orderedSemesters],
  );

  const timelineData = useMemo(
    () =>
      semesterSummaries.map((summary) => {
        const gpaValue = Number(summary.gpa.toFixed(2));
        return {
          label: summary.name,
          gpa: gpaValue,
          color: getGpaColor(gpaValue),
        };
      }),
    [semesterSummaries],
  );

  const dashboardSummary = useMemo(
    () => ({
      overallGpa,
      totalCredits,
      totalSemesters,
    }),
    [overallGpa, totalCredits, totalSemesters],
  );

  useEffect(() => {
    const storedMessage = readStoredDashboardMessage(dashboardMessageScopeId);
    setDashboardMessage(storedMessage);
    setDashboardMessageDraft(storedMessage);
  }, [dashboardMessageScopeId]);

  useEffect(() => {
    if (loading) return;
    if (snapshotDebounceRef.current) {
      clearTimeout(snapshotDebounceRef.current);
    }
    snapshotDebounceRef.current = setTimeout(() => {
      const snapshot = captureSnapshot();
      pushSnapshotIfChanged(snapshot);
      snapshotDebounceRef.current = null;
    }, 350);
    return () => {
      if (snapshotDebounceRef.current) {
        clearTimeout(snapshotDebounceRef.current);
      }
    };
  }, [captureSnapshot, loading, pushSnapshotIfChanged]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isModifier = event.metaKey || event.ctrlKey;
      if (!isModifier) return;
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
      } else if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [handleRedo, handleUndo]);

  useEffect(() => {
    const handleResponsiveSidebar = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };
    handleResponsiveSidebar();
    window.addEventListener("resize", handleResponsiveSidebar);
    return () => window.removeEventListener("resize", handleResponsiveSidebar);
  }, []);

  // Redirect unauthenticated users to home
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/");
    }
  }, [status, router]);

  // -------------------------------
  // LOAD DATA FROM HYBRID STORAGE LAYER
  // -------------------------------

  const loadSemesters = useCallback(async (urlSemesterId?: string | null) => {
    try {
      setLoading(true);
      setServerOffline(false);
      const loadedSemesters = await storage.getSemesters();
      const mergedSemesters = applyStoredSettingsToSemesters(loadedSemesters);
      setSemesters(
        mergedSemesters.map((s) => ({
          ...s,
          courses: s.courses.map((c) => ({ ...c, collapsed: true })),
        })),
      );

      const savedOrder = readStoredSemesterOrder();
      if (savedOrder.length > 0) {
        const validOrder = savedOrder.filter((id) =>
          mergedSemesters.some((semester) => semester.id === id),
        );
        if (validOrder.length > 0) {
          setSemesterOrder(validOrder);
        }
      }

      if (urlSemesterId !== undefined) {
        // URL override: use the URL-derived semester ID
        if (urlSemesterId === null) {
          setActiveSemesterId(null);
        } else if (loadedSemesters.find((s) => s.id === urlSemesterId)) {
          setActiveSemesterId(urlSemesterId);
        } else if (loadedSemesters.length > 0) {
          setActiveSemesterId(loadedSemesters[0].id);
        }
      } else {
        // Fall back to localStorage
        const savedActiveSemester = localStorage.getItem(
          ACTIVE_SEMESTER_STORAGE_KEY,
        );
        if (savedActiveSemester === DASHBOARD_SENTINEL) {
          setActiveSemesterId(null);
        } else if (
          savedActiveSemester &&
          loadedSemesters.find((s) => s.id === savedActiveSemester)
        ) {
          setActiveSemesterId(savedActiveSemester);
        } else if (loadedSemesters.length > 0) {
          setActiveSemesterId(loadedSemesters[0].id);
        }
      }
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        console.error("[v0] Server offline while loading semesters.");
        setServerOffline(true);
        setSemesters([]);
        setActiveSemesterId(null);
      } else {
        console.error("[v0] Failed to load semesters:", error);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const dataLoadedRef = useRef(false);

  useEffect(() => {
    if (status === "authenticated") {
      const scopeId = session?.user?.id || session?.user?.email || "default";
      storage.setUserScope(scopeId);
      loadSemesters(routeSemesterId);
    } else if (status === "unauthenticated") {
      storage.setUserScope("default");
      setServerOffline(false);
      setSemesters([]);
      setActiveSemesterId(null);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session, loadSemesters]); // routeSemesterId intentionally omitted — only needed on initial load

  // Sync activeSemesterId from URL on subsequent navigations (not initial load)
  useEffect(() => {
    if (!dataLoadedRef.current) return;
    if (routeSemesterId !== undefined) {
      setActiveSemesterId(routeSemesterId);
    }
  }, [routeSemesterId]);

  useEffect(() => {
    if (!loading) {
      dataLoadedRef.current = true;
    }
  }, [loading]);

  // -------------------------------
  // SAVE ACTIVE SEMESTER
  // -------------------------------

  useEffect(() => {
    if (activeSemesterId === null) {
      localStorage.setItem(ACTIVE_SEMESTER_STORAGE_KEY, DASHBOARD_SENTINEL);
    } else {
      localStorage.setItem(ACTIVE_SEMESTER_STORAGE_KEY, activeSemesterId);
    }
  }, [activeSemesterId]);

  useEffect(() => {
    if (loading) return;
    if (isDashboardView) {
      document.title = "Dashboard";
    } else if (activeSemester) {
      document.title = activeSemester.name;
    } else {
      document.title = "CourseGrade";
    }
  }, [isDashboardView, activeSemester, loading]);

  // -------------------------------
  // SCROLL FUNCTIONALITY
  // -------------------------------

  const scrollToCourse = (courseId: string) => {
    const element = courseRefs.current[courseId];
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setHighlightedCourseId(courseId);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(
        () => setHighlightedCourseId(null),
        1800,
      );
    }
  };

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

  // -------------------------------
  // SEMESTER MANAGEMENT
  // -------------------------------

  const addSemester = async () => {
    try {
      const newSemester = await storage.createSemester(
        `Semester ${semesters.length + 1}`,
      );
      setSemesters((prev) => [...prev, newSemester]);
      setActiveSemesterId(newSemester.id);
      router.push("/semesters/" + newSemester.id);
      setServerOffline(false);
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        setServerOffline(true);
      } else {
        console.error("[v0] Failed to create semester:", error);
      }
    }
  };

  const deleteSemester = async (semesterId: string) => {
    try {
      await storage.deleteSemester(semesterId);
      setSemesters((prev) => {
        const updated = prev.filter((s) => s.id !== semesterId);
        if (activeSemesterId === semesterId) {
          const nextId = updated.length > 0 ? updated[0].id : null;
          setActiveSemesterId(nextId);
          if (nextId) {
            router.push("/semesters/" + nextId);
          } else {
            router.push("/dashboard");
          }
        }
        return updated;
      });
      setServerOffline(false);
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        setServerOffline(true);
      } else {
        console.error("[v0] Failed to delete semester:", error);
      }
    }
  };

  const editSemester = async (semesterId: string, newName: string) => {
    try {
      await storage.updateSemester(semesterId, { name: newName });
      setSemesters((prev) =>
        prev.map((s) => (s.id === semesterId ? { ...s, name: newName } : s)),
      );
      setServerOffline(false);
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        setServerOffline(true);
      } else {
        console.error("[v0] Failed to update semester:", error);
      }
    }
  };

  const clearAllData = async () => {
    for (const s of semesters) {
      try {
        await storage.deleteSemester(s.id);
      } catch {
        /* best effort */
      }
    }
    setSemesters([]);
    setActiveSemesterId(null);
    localStorage.removeItem("grade-calculator-course-settings");
  };

  const duplicateSemester = async (semesterId: string) => {
    const src = semesters.find((s) => s.id === semesterId);
    if (!src) return;
    try {
      const newSem = await storage.createSemester(`${src.name} (Copy)`);
      const syncedCourses: Course[] = [];
      for (const c of src.courses) {
        syncedCourses.push(
          await importPortableCourse(courseToPortable(c), newSem.id),
        );
      }
      setSemesters((prev) => [...prev, { ...newSem, courses: syncedCourses }]);
      setServerOffline(false);
    } catch (error) {
      if (error instanceof ApiUnavailableError) setServerOffline(true);
      else console.error("[v0] Failed to duplicate semester:", error);
    }
  };

  // -------------------------------
  // COURSE MANAGEMENT
  // -------------------------------

  const addCourse = async () => {
    if (!activeSemesterId) return;

    try {
      const newCourse = await storage.createCourse(
        activeSemesterId,
        `Course ${courses.length + 1}`,
        appSettings.defaultCredits,
      );
      newCourse.gradeScale = appSettings.defaultGradeScale.map((g) => ({
        ...g,
      }));

      setSemesters((prev) =>
        prev.map((s) =>
          s.id === activeSemesterId
            ? { ...s, courses: [...s.courses, newCourse] }
            : s,
        ),
      );
      setServerOffline(false);

      setTimeout(() => {
        scrollToCourse(newCourse.id);
      }, 100);
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        setServerOffline(true);
      } else {
        console.error("[v0] Failed to create course:", error);
      }
    }
  };

  const importPortableCourse = useCallback(
    async (
      courseData: CoursePortableData,
      semesterId: string,
    ): Promise<Course> => {
      const numericOr = (value: number | undefined, fallback: number) =>
        typeof value === "number" && Number.isFinite(value) ? value : fallback;
      const fallbackName =
        typeof courseData.name === "string" && courseData.name.length > 0
          ? courseData.name
          : `Imported Course`;
      const baseCourse = await storage.createCourse(
        semesterId,
        fallbackName,
        numericOr(courseData.credits, 0),
      );
      const normalizedCriteria =
        courseData.criteria?.map((criterion, index) => ({
          id: "",
          clientId: generateClientId(),
          name:
            typeof criterion.name === "string" && criterion.name.length > 0
              ? criterion.name
              : `Criterion ${index + 1}`,
          weight: numericOr(criterion.weight, 0),
          score: numericOr(criterion.score, 0),
          extraCredit: numericOr(criterion.extraCredit, 0),
          dropLowest: Math.max(
            0,
            Math.floor(numericOr(criterion.dropLowest, 0)),
          ),
          subItems: (criterion.subItems ?? []).map((subItem, subIndex) => ({
            id: generateClientId(),
            name:
              typeof subItem.name === "string" && subItem.name.length > 0
                ? subItem.name
                : `Item ${subIndex + 1}`,
            score: numericOr(subItem.score, 0),
          })),
        })) ?? [];

      const updatedCourse: Course = {
        ...baseCourse,
        name: fallbackName,
        credits: numericOr(courseData.credits, baseCourse.credits),
        isPassFail: courseData.isPassFail ?? baseCourse.isPassFail ?? false,
        passLabel: courseData.passLabel ?? baseCourse.passLabel ?? "P",
        failLabel: courseData.failLabel ?? baseCourse.failLabel ?? "F",
        passThreshold: numericOr(
          courseData.passThreshold,
          baseCourse.passThreshold ?? 60,
        ),
        cardColor: courseData.cardColor ?? baseCourse.cardColor ?? null,
        percentBoost: Math.max(
          0,
          Math.min(
            100,
            numericOr(courseData.percentBoost, baseCourse.percentBoost ?? 0),
          ),
        ),
        gradeScale:
          courseData.gradeScale && courseData.gradeScale.length > 0
            ? courseData.gradeScale
            : baseCourse.gradeScale,
        criteria:
          normalizedCriteria.length > 0
            ? normalizedCriteria
            : baseCourse.criteria,
      };

      const syncedCourse = await storage.updateCourse(
        semesterId,
        updatedCourse,
      );
      persistCourseSettings(syncedCourse);
      return syncedCourse;
    },
    [],
  );

  const updateCourse = async (id: string, updatedCourse: Course) => {
    if (!activeSemesterId) return;

    const baseCriteria = Array.isArray(updatedCourse.criteria)
      ? updatedCourse.criteria
      : [];
    const normalizedPercentBoost = Math.max(
      0,
      Math.min(
        100,
        Number.isFinite(updatedCourse.percentBoost ?? 0)
          ? (updatedCourse.percentBoost ?? 0)
          : 0,
      ),
    );
    const stateCriteria = baseCriteria.map((criterion) => ({
      ...criterion,
      name: typeof criterion.name === "string" ? criterion.name : "",
      subItems: Array.isArray(criterion.subItems) ? criterion.subItems : [],
    }));
    const stateCourse: Course = {
      ...updatedCourse,
      name: typeof updatedCourse.name === "string" ? updatedCourse.name : "",
      percentBoost: normalizedPercentBoost,
      criteria: stateCriteria,
    };
    const sanitizedCriteria = stateCriteria.map((criterion) => ({
      ...criterion,
      name: criterion.name.length > 0 ? criterion.name : ``,
    }));
    const sanitizedCourse: Course = {
      ...stateCourse,
      name: stateCourse.name.length > 0 ? stateCourse.name : "",
      percentBoost: normalizedPercentBoost,
      criteria: sanitizedCriteria,
    };

    const applyCourseUpdate = (nextCourse: Course) => {
      setSemesters((prev) =>
        prev.map((s) =>
          s.id === activeSemesterId
            ? {
                ...s,
                courses: s.courses.map((c) => (c.id === id ? nextCourse : c)),
              }
            : s,
        ),
      );
    };

    applyCourseUpdate(stateCourse);
    persistCourseSettings(sanitizedCourse);

    const isServerCourse = isServerResourceId(id);
    const isServerSemester = isServerResourceId(activeSemesterId);

    if (!isServerCourse || !isServerSemester) {
      console.warn(
        "[v0] Skipping course sync until course and semester have server IDs.",
      );
      return;
    }

    setSaveStatus("saving");
    try {
      const syncedCourse = await storage.updateCourse(
        activeSemesterId,
        sanitizedCourse,
      );
      // Only update criteria (to pick up server-assigned IDs for new assignments).
      // Preserve all other in-memory state (e.g. collapsed) to avoid race conditions
      // where a stale snapshot from a concurrent call overwrites a newer local change.
      setSemesters((prev) =>
        prev.map((s) =>
          s.id === activeSemesterId
            ? {
                ...s,
                courses: s.courses.map((c) =>
                  c.id === id ? { ...c, criteria: syncedCourse.criteria } : c,
                ),
              }
            : s,
        ),
      );
      persistCourseSettings(syncedCourse);
      setServerOffline(false);
      setSaveStatus("saved");
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = setTimeout(
        () => setSaveStatus("idle"),
        2000,
      );
    } catch (error) {
      setSaveStatus("error");
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = setTimeout(
        () => setSaveStatus("idle"),
        3000,
      );
      if (error instanceof ApiUnavailableError) {
        setServerOffline(true);
      } else {
        console.error("[v0] Failed to update course:", error);
      }
    }
  };

  const exportSemesterToJson = useCallback(
    (semesterId: string) => {
      const semester = semesters.find((s) => s.id === semesterId);
      if (!semester) return;
      const csv = serializeSemesterCsv(semester);
      const filename = `${safeFilename(semester.name, "semester")}.json`;
      triggerFileDownload(filename, csv);
    },
    [semesters],
  );

  const exportCourseToJson = useCallback(
    (courseId: string) => {
      for (const semester of semesters) {
        const course = semester.courses.find((c) => c.id === courseId);
        if (course) {
          const csv = serializeCourseCsv(course);
          const filename = `${safeFilename(course.name, "course")}.json`;
          triggerFileDownload(filename, csv);
          return;
        }
      }
    },
    [semesters],
  );

  const exportDashboardBackup = useCallback(() => {
    const payload: DashboardBackupPayload = {
      version: 1,
      generatedAt: new Date().toISOString(),
      semesterOrder,
      semesters: semesters.map((semester) => ({
        id: semester.id,
        name: semester.name,
        background: semester.background,
        timelineDate: semester.timelineDate ?? null,
        courses: semester.courses.map(courseToPortable),
      })),
    };
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `coursegrade-dashboard-${timestamp}.json`;
    triggerFileDownload(filename, JSON.stringify(payload, null, 2));
  }, [semesterOrder, semesters]);

  const importSemesterFromJson = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const data = parseSemesterCsv(text);
        const desiredName =
          typeof data.name === "string" && data.name.length > 0
            ? data.name
            : `Imported Semester ${semesters.length + 1}`;
        const created = await storage.createSemester(desiredName);
        const background = data.background ?? created.background;
        if (background !== created.background || desiredName !== created.name) {
          await storage.updateSemester(created.id, {
            name: desiredName,
            background,
          });
        }
        const importedCourses: Course[] = [];
        for (const courseData of data.courses ?? []) {
          const importedCourse = await importPortableCourse(
            courseData,
            created.id,
          );
          importedCourses.push(importedCourse);
        }
        const merged: Semester = {
          ...created,
          name: desiredName,
          background,
          courses: importedCourses,
        };
        setSemesters((prev) => [...prev, merged]);
        setActiveSemesterId(merged.id);
        router.push("/semesters/" + merged.id);
        setServerOffline(false);
      } catch (error) {
        if (error instanceof ApiUnavailableError) {
          setServerOffline(true);
        } else {
          console.error("[v0] Failed to import semester JSON:", error);
        }
      }
    },
    [importPortableCourse, semesters.length, router],
  );

  const importCourseFromJson = useCallback(
    async (file: File, semesterId: string | null) => {
      if (!semesterId) return;
      try {
        const text = await file.text();
        const data = parseCourseCsv(text);
        const importedCourse = await importPortableCourse(data, semesterId);
        setSemesters((prev) =>
          prev.map((semester) =>
            semester.id === semesterId
              ? { ...semester, courses: [...semester.courses, importedCourse] }
              : semester,
          ),
        );
        setServerOffline(false);
      } catch (error) {
        if (error instanceof ApiUnavailableError) {
          setServerOffline(true);
        } else {
          console.error("[v0] Failed to import course JSON:", error);
        }
      }
    },
    [importPortableCourse],
  );

  const importCourseFromSyllabus = useCallback(
    async (data: CoursePortableData, semesterId: string) => {
      const importedCourse = await importPortableCourse(data, semesterId);
      setSemesters((prev) =>
        prev.map((s) =>
          s.id === semesterId
            ? { ...s, courses: [...s.courses, importedCourse] }
            : s,
        ),
      );
      setTimeout(() => scrollToCourse(importedCourse.id), 100);
      setServerOffline(false);
    },
    [importPortableCourse],
  );

  const duplicateCourse = async (courseId: string) => {
    if (!activeSemesterId) return;
    const course = courses.find((c) => c.id === courseId);
    if (!course) return;
    try {
      const duplicated = await importPortableCourse(
        courseToPortable(course),
        activeSemesterId,
      );
      setSemesters((prev) =>
        prev.map((s) =>
          s.id === activeSemesterId
            ? { ...s, courses: [...s.courses, duplicated] }
            : s,
        ),
      );
      setServerOffline(false);
      setTimeout(() => scrollToCourse(duplicated.id), 100);
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        setServerOffline(true);
      } else {
        console.error("[v0] Failed to duplicate course:", error);
      }
    }
  };

  const collapseAllCourses = () => {
    if (!activeSemesterId) return;
    setSemesters((prev) =>
      prev.map((s) =>
        s.id === activeSemesterId
          ? { ...s, courses: s.courses.map((c) => ({ ...c, collapsed: true })) }
          : s,
      ),
    );
  };

  const expandAllCourses = () => {
    if (!activeSemesterId) return;
    setSemesters((prev) =>
      prev.map((s) =>
        s.id === activeSemesterId
          ? {
              ...s,
              courses: s.courses.map((c) => ({ ...c, collapsed: false })),
            }
          : s,
      ),
    );
  };

  const generateShareUrl = useCallback(() => {
    const semester = semesters.find((s) => s.id === activeSemesterId);
    if (!semester) return;
    const payload = {
      name: semester.name,
      courses: semester.courses.map((c) => ({
        name: c.name,
        credits: c.credits,
        isPassFail: c.isPassFail,
        percentBoost: c.percentBoost,
        criteria: c.criteria.map((cr) => ({
          name: cr.name,
          weight: cr.weight,
          score: cr.score,
          dropLowest: cr.dropLowest,
          extraCredit: cr.extraCredit,
          subItems: cr.subItems,
        })),
        gradeScale: c.gradeScale,
      })),
    };
    const encoded = encodeURIComponent(JSON.stringify(payload));
    const url = `${window.location.origin}/share?data=${encoded}`;
    setShareUrl(url);
    setShareCopied(false);
  }, [semesters, activeSemesterId]);

  const importDashboardBackup = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const payload = JSON.parse(text) as Partial<DashboardBackupPayload>;
        if (!payload || !Array.isArray(payload.semesters)) {
          throw new Error("Invalid dashboard backup file");
        }
        const orderMap = new Map<string, number>();
        if (Array.isArray(payload.semesterOrder)) {
          payload.semesterOrder.forEach((oldId, index) => {
            if (typeof oldId === "string") {
              orderMap.set(oldId, index);
            }
          });
        }
        const createdSemesters: Array<{
          semester: Semester;
          orderIndex: number;
        }> = [];
        for (const [index, semesterData] of payload.semesters.entries()) {
          const safeName =
            typeof semesterData?.name === "string" &&
            semesterData.name.length > 0
              ? semesterData.name
              : `Imported Semester ${
                  semesters.length + createdSemesters.length + 1
                }`;
          const created = await storage.createSemester(
            safeName,
            semesterData?.timelineDate ?? null,
          );
          const background = semesterData?.background ?? created.background;
          if (
            background !== created.background ||
            safeName !== created.name ||
            (semesterData?.timelineDate ?? null) !==
              (created.timelineDate ?? null)
          ) {
            await storage.updateSemester(created.id, {
              name: safeName,
              background,
              timelineDate: semesterData?.timelineDate ?? null,
            });
          }
          const importedCourses: Course[] = [];
          for (const courseData of semesterData?.courses ?? []) {
            const importedCourse = await importPortableCourse(
              courseData,
              created.id,
            );
            importedCourses.push(importedCourse);
          }
          const semesterRecord: Semester = {
            ...created,
            name: safeName,
            background,
            timelineDate:
              semesterData?.timelineDate ?? created.timelineDate ?? null,
            courses: importedCourses,
          };
          const orderIndex =
            (typeof semesterData?.id === "string" &&
            orderMap.has(semesterData.id)
              ? orderMap.get(semesterData.id)
              : undefined) ?? index;
          createdSemesters.push({ semester: semesterRecord, orderIndex });
        }
        if (createdSemesters.length > 0) {
          const orderedImports = createdSemesters
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((entry) => entry.semester);
          setSemesters((prev) => [...prev, ...orderedImports]);
          setSemesterOrder((prev) => [
            ...prev,
            ...orderedImports.map((semester) => semester.id),
          ]);
          setActiveSemesterId(orderedImports[0].id);
          router.push("/semesters/" + orderedImports[0].id);
        }
        setServerOffline(false);
      } catch (error) {
        if (error instanceof ApiUnavailableError) {
          setServerOffline(true);
        } else {
          console.error("[v0] Failed to import dashboard backup:", error);
        }
      }
    },
    [importPortableCourse, semesters.length, router],
  );

  const deleteCourse = async (id: string) => {
    if (!activeSemesterId) return;

    try {
      if (isServerResourceId(activeSemesterId) && isServerResourceId(id)) {
        await storage.deleteCourse(activeSemesterId, id);
      }
      removeCourseSettings(id);
      setSemesters((prev) =>
        prev.map((s) =>
          s.id === activeSemesterId
            ? { ...s, courses: s.courses.filter((c) => c.id !== id) }
            : s,
        ),
      );
      setServerOffline(false);
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        setServerOffline(true);
      } else {
        console.error("[v0] Failed to delete course:", error);
      }
    }
  };

  const handleReorderSemesters = useCallback((orderedIds: string[]) => {
    if (orderedIds.length === 0) return;
    setSemesterOrder(orderedIds);
    setSemesters((previous) => {
      const semesterMap = new Map(
        previous.map((semester) => [semester.id, semester]),
      );
      const reordered = orderedIds
        .map((id) => semesterMap.get(id))
        .filter((semester): semester is Semester => Boolean(semester));
      if (reordered.length === previous.length) {
        return reordered;
      }
      const extras = previous.filter(
        (semester) => !orderedIds.includes(semester.id),
      );
      return [...reordered, ...extras];
    });
  }, []);

  const handleReorderCourses = useCallback(
    (semesterId: string, orderedCourseIds: string[]) => {
      if (!semesterId || orderedCourseIds.length === 0) return;
      setSemesters((previous) =>
        previous.map((semester) => {
          if (semester.id !== semesterId) return semester;
          const courseMap = new Map(
            semester.courses.map((course) => [course.id, course]),
          );
          const reordered = orderedCourseIds
            .map((courseId) => courseMap.get(courseId))
            .filter((course): course is Course => Boolean(course));
          if (reordered.length === semester.courses.length) {
            return {
              ...semester,
              courses: reordered,
            };
          }
          const extras = semester.courses.filter(
            (course) => !orderedCourseIds.includes(course.id),
          );
          return {
            ...semester,
            courses: [...reordered, ...extras],
          };
        }),
      );
    },
    [],
  );

  const editCourse = async (courseId: string, newName: string) => {
    if (!activeSemesterId) return;
    const course = courses.find((c) => c.id === courseId);
    if (course) {
      await updateCourse(courseId, { ...course, name: newName });
    }
  };

  // -------------------------------
  // MAIN RENDER
  // -------------------------------

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
              onCourseClick={(id) => {
                setSidebarOpen(false);
                scrollToCourse(id);
              }}
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
        onClose={() => {
          setSettingsOpen(false);
          setAppSettings(loadAppSettings());
        }}
        onClearAllData={clearAllData}
        userEmail={session?.user?.email ?? undefined}
        userId={session?.user?.id ?? session?.user?.email ?? undefined}
      />

      <div
        className="w-full px-4 py-8 transition-all duration-300 md:pl-[14rem] lg:pl-[17rem]"
        style={{
          paddingRight: "1rem",
        }}
      >
        {isDashboardView ? (
          <div className="space-y-6">
            <p className="w-fit mx-auto text-2xl font-bold uppercase tracking-widest bg-primary text-white px-8 py-2 [box-shadow:5px_5px_0_rgba(77,31,26,0.55),10px_10px_0_rgba(77,31,26,0.25)]">
              Dashboard
            </p>
            <div className="w-full rounded-lg border border-primary/35 bg-card/85 shadow-under-white-soft overflow-hidden flex">
              {/* Left 30% — label */}
              <div className="relative flex shrink-0 items-center justify-center bg-primary border-r border-primary/20 px-5 py-4 overflow-hidden">
                <p className="relative font-etna text-2xl text-white leading-none">
                  quote.
                </p>
              </div>
              {/* Right 70% — message */}
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
                      onChange={(event) =>
                        setDashboardMessageDraft(event.target.value)
                      }
                      placeholder="Your motivational quote..."
                      rows={2}
                      maxLength={280}
                      className="w-full resize-none rounded-md border border-primary/25 bg-background/90 px-3 py-1.5 text-sm text-foreground outline-none transition focus:border-primary/45"
                    />
                    <div className="mt-2 flex items-center gap-2">
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
            </div>

            {semesters.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-5 rounded-xl border-2 border-dashed border-primary/20 bg-card/40 py-20 text-center">
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
                <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 2fr 1fr" }}>
                  {[
                    { label: "Total Credits", content: <p className="mt-2 text-5xl font-bold text-white">{totalCredits}</p> },
                    { label: "Overall GPA", content: <div className="mt-1 flex items-center justify-between pr-8"><p className="flex items-baseline gap-2 text-4xl font-bold text-white"><TrendingUp className="h-5 w-5 text-white/60" />{overallGpa.toFixed(2)}</p><span className="text-7xl font-black text-white/80">{overallGpaLetter}</span></div> },
                    { label: "Semesters Tracked", content: <p className="mt-2 text-5xl font-bold text-white">{totalSemesters}</p> },
                  ].map(({ label, content }) => (
                    <div key={label} className="relative overflow-hidden rounded-lg bg-primary p-4 text-left"
                      style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 20px), repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 20px)" }}>
                      <p className="text-sm font-medium text-white/60 uppercase tracking-widest">{label}</p>
                      {content}
                    </div>
                  ))}
                </div>

                <DashboardPanel
                  timelineData={timelineData}
                  courses={allCourses}
                />

                <div className="grid p-4 pb-0 gap-4 lg:grid">
                  {semesterSummaries.map((summary, i) => {
                    const even = i % 2 === 0;
                    const skew = even ? -2 : 2;
                    return (
                      <div
                        key={summary.id}
                        className="relative overflow-hidden p-5 text-left"
                        style={{
                          backgroundColor:
                            "color-mix(in srgb, var(--primary) 75%, black)",
                        }}
                      >
                        <div
                          className="flex items-center justify-between"
                          style={{ transform: `skewX(${-skew}deg)` }}
                        >
                          <p className="text-xl font-bold text-white uppercase tracking-wide">
                            {summary.name}
                          </p>
                          <span className="text-2xl font-black text-white">
                            {summary.gpa.toFixed(2)} GPA
                          </span>
                        </div>
                        <p
                          className="mt-1 text-sm text-white/60"
                          style={{ transform: `skewX(${-skew}deg)` }}
                        >
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
            {/* ── Dark header: title + action buttons + semester summary ── */}
            <div
              className="-mx-4 -mt-8 px-4 pt-8 pb-0"
              style={{
                background: "#2d0008",
                backgroundImage:
                  "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 40px)",
              }}
            >
              {/* Title */}
              <div className="mb-6">
                {isEditingSemesterName ? (
                  <div className="flex items-center justify-center gap-2">
                    <input
                      autoFocus
                      value={semesterNameDraft}
                      onChange={(e) => setSemesterNameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          semesterNameDraft.trim() &&
                          activeSemesterId
                        ) {
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

              {/* Action buttons — match title color scheme */}
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
                      onClick={() => {
                        if (shareUrl) {
                          setShareUrl(null);
                        } else {
                          generateShareUrl();
                        }
                      }}
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
                            onClick={() => {
                              navigator.clipboard.writeText(shareUrl);
                              setShareCopied(true);
                              setTimeout(() => setShareCopied(false), 2000);
                            }}
                          >
                            {shareCopied ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <Share2 className="h-3 w-3" />
                            )}
                            {shareCopied ? "Copied!" : "Copy"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Semester summary — no box, bare on dark bg */}
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
                      ref={(el) => {
                        courseRefs.current[course.id] = el;
                      }}
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
                          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
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
                          borderRadius:
                            dragOverMainCourseId === course.id ? "12px" : undefined,
                          cursor: draggingMainCourseId ? "grabbing" : "grab",
                        }}
                      >
                        <CourseCard
                          course={course}
                          highlighted={highlightedCourseId === course.id}
                          onUpdate={(courseId, nextCourse) =>
                            updateCourse(courseId, nextCourse)
                          }
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
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      importCourseFromJson(file, activeSemesterId);
                    }
                    event.target.value = "";
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
                    onClick={() =>
                      document.getElementById("course-import-trigger")?.click()
                    }
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
