"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { CourseCard } from "@/components/course-card";
import { CourseSidebar } from "@/components/course-sidebar";
import { GpaSummary } from "@/components/gpa-summary";
import { GradeDistributionChart } from "@/components/grade-distribution-chart";
import { GpaTimelineChart } from "@/components/gpa-timeline-chart";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Menu,
  Upload,
  Download,
  TrendingUp,
  Layers,
  Pencil,
  Sparkles,
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
import { ChatPanel, type ChatAction, type ChatActionResult } from "@/components/chat-panel";

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
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [isEditingSemesterName, setIsEditingSemesterName] = useState(false);
  const [semesterNameDraft, setSemesterNameDraft] = useState("");
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
    () => (allCourses.length > 0 ? calculateGPA(allCourses) : 0),
    [allCourses],
  );
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
        const gpa = coursesList.length > 0 ? calculateGPA(coursesList) : 0;
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
    setIsEditingQuote(true);
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

  // -------------------------------
  // COURSE MANAGEMENT
  // -------------------------------

  const addCourse = async () => {
    if (!activeSemesterId) return;

    try {
      const newCourse = await storage.createCourse(
        activeSemesterId,
        `Course ${courses.length + 1}`,
        3,
      );

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
    } catch (error) {
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

  const handleChatActions = async (actions: ChatAction[]): Promise<ChatActionResult> => {
    const result: ChatActionResult = { applied: 0, failed: 0, errors: [] };
    if (actions.length === 0) return result;

    // Local snapshot for reads — React state is stale within an async loop
    let snap: Semester[] = semesters.map((s) => ({
      ...s,
      courses: s.courses.map((c) => ({
        ...c,
        criteria: c.criteria.map((cr) => ({
          ...cr,
          subItems: cr.subItems ? [...cr.subItems] : [],
        })),
      })),
    }));
    const originalSnap = JSON.stringify(snap);

    // Track created resource IDs so batch actions can chain
    let workingSemId = activeSemesterId;
    let lastCourseId: string | null = null;
    let lastCriterionId: string | null = null;

    // Fuzzy course resolution: exact ID → name match → last created
    const resolveCourseId = (rawId: string): string | null => {
      const sem = snap.find((s) => s.id === workingSemId);
      if (!sem) return lastCourseId;
      // Exact ID match
      if (sem.courses.some((c) => c.id === rawId)) return rawId;
      // Fuzzy: match by name (AI often sends name instead of ID)
      const byName = sem.courses.find(
        (c) => c.name.toLowerCase().trim() === rawId.toLowerCase().trim(),
      );
      if (byName) return byName.id;
      // Partial name match (e.g. "Math" matches "Math 101")
      const byPartial = sem.courses.filter(
        (c) => c.name.toLowerCase().includes(rawId.toLowerCase().trim()),
      );
      if (byPartial.length === 1) return byPartial[0].id;
      // If only one course, use it
      if (sem.courses.length === 1) return sem.courses[0].id;
      return lastCourseId ?? rawId;
    };

    // Fuzzy criterion resolution: exact ID → name match → last created
    const resolveCriterionId = (course: Course, rawId: string, rawName?: string): string | null => {
      // Exact ID match
      if (course.criteria.some((cr) => cr.id === rawId)) return rawId;
      // Fuzzy: match by name if provided
      if (rawName) {
        const byName = course.criteria.find(
          (cr) => cr.name.toLowerCase() === rawName.toLowerCase(),
        );
        if (byName) return byName.id;
      }
      // Fuzzy: try rawId as a name (AI often sends name instead of ID)
      const byRawName = course.criteria.find(
        (cr) => cr.name.toLowerCase().trim() === rawId.toLowerCase().trim(),
      );
      if (byRawName) return byRawName.id;
      // Partial name match on rawId
      const byPartial = course.criteria.filter(
        (cr) => cr.name.toLowerCase().includes(rawId.toLowerCase().trim()),
      );
      if (byPartial.length === 1) return byPartial[0].id;
      // If only one criterion, use it
      if (course.criteria.length === 1) return course.criteria[0].id;
      return lastCriterionId ?? rawId;
    };

    for (const action of actions) {
      try {
        // --- Semester operations ---
        if (action.type === "add_semester") {
          const newSem = await storage.createSemester(action.name);
          snap = [...snap, newSem];
          workingSemId = newSem.id;
          setServerOffline(false);
          result.applied++;
          continue;
        }
        if (action.type === "delete_semester") {
          await deleteSemester(action.semesterId);
          snap = snap.filter((s) => s.id !== action.semesterId);
          result.applied++;
          continue;
        }
        if (action.type === "rename_semester") {
          await editSemester(action.semesterId, action.newName);
          snap = snap.map((s) =>
            s.id === action.semesterId ? { ...s, name: action.newName } : s,
          );
          result.applied++;
          continue;
        }
        if (action.type === "duplicate_semester") {
          const src = snap.find((s) => s.id === action.semesterId);
          if (!src) {
            result.failed++;
            result.errors.push(`Semester not found for duplicate.`);
            continue;
          }
          try {
            const newSem = await storage.createSemester(`${src.name} (Copy)`);
            const syncedCourses: Course[] = [];
            for (const c of src.courses) {
              syncedCourses.push(
                await importPortableCourse(courseToPortable(c), newSem.id),
              );
            }
            snap = [...snap, { ...newSem, courses: syncedCourses }];
            workingSemId = newSem.id;
            setServerOffline(false);
            result.applied++;
          } catch (error) {
            if (error instanceof ApiUnavailableError) setServerOffline(true);
            result.failed++;
            result.errors.push(`Failed to duplicate semester.`);
          }
          continue;
        }

        // --- Course / criterion / sub-item operations target working semester ---
        const semId = workingSemId;
        if (!semId) {
          result.failed++;
          result.errors.push(`No active semester for action "${action.type}".`);
          continue;
        }

        if (action.type === "add_course") {
          const newCourse = await storage.createCourse(
            semId,
            action.name,
            action.credits,
          );
          snap = snap.map((s) =>
            s.id === semId
              ? { ...s, courses: [...s.courses, newCourse] }
              : s,
          );
          lastCourseId = newCourse.id;
          lastCriterionId = null;
          setServerOffline(false);
          result.applied++;
          continue;
        }

        if (action.type === "delete_course") {
          const cid = resolveCourseId(action.courseId);
          if (!cid) { result.failed++; result.errors.push(`Course not found for delete.`); continue; }
          if (isServerResourceId(semId) && isServerResourceId(cid)) {
            await storage.deleteCourse(semId, cid);
          }
          removeCourseSettings(cid);
          snap = snap.map((s) =>
            s.id === semId
              ? { ...s, courses: s.courses.filter((c) => c.id !== cid) }
              : s,
          );
          result.applied++;
          continue;
        }

        if (action.type === "duplicate_course") {
          const cid = resolveCourseId(action.courseId);
          if (!cid) { result.failed++; result.errors.push(`Course not found for duplicate.`); continue; }
          const sem = snap.find((s) => s.id === semId);
          const course = sem?.courses.find((c) => c.id === cid);
          if (course) {
            const dup = await importPortableCourse(
              courseToPortable(course),
              semId,
            );
            snap = snap.map((s) =>
              s.id === semId
                ? { ...s, courses: [...s.courses, dup] }
                : s,
            );
            lastCourseId = dup.id;
            result.applied++;
          } else {
            result.failed++;
            result.errors.push(`Course not found for duplicate.`);
          }
          continue;
        }

        // --- Actions needing a course object ---
        const courseId = "courseId" in action
          ? resolveCourseId((action as { courseId: string }).courseId)
          : lastCourseId;
        if (!courseId) {
          result.failed++;
          result.errors.push(`Could not resolve course for "${action.type}".`);
          continue;
        }

        const sem = snap.find((s) => s.id === semId);
        const course = sem?.courses.find((c) => c.id === courseId);
        if (!course) {
          result.failed++;
          result.errors.push(`Course not found for "${action.type}".`);
          continue;
        }

        let updated: Course;

        if (action.type === "rename_course") {
          updated = { ...course, name: action.newName };
        } else if (action.type === "set_credits") {
          updated = { ...course, credits: action.credits };
        } else if (action.type === "set_pass_fail") {
          updated = { ...course, isPassFail: action.isPassFail };
        } else if (action.type === "set_percent_boost") {
          updated = { ...course, percentBoost: action.percentBoost };
        } else if (action.type === "update_criterion") {
          // Extract name from changes for fuzzy matching
          const crName = typeof action.changes.name === "string" ? action.changes.name : undefined;
          const crId = resolveCriterionId(course, action.criterionId, crName);
          if (!crId || !course.criteria.some((cr) => cr.id === crId)) {
            // Criterion not found — this is a common AI mistake
            result.failed++;
            result.errors.push(
              `Criterion "${action.criterionId}" not found in "${course.name}". ` +
              (course.criteria.length === 0
                ? "This course has no criteria to update."
                : `Available: ${course.criteria.map((cr) => cr.name).join(", ")}.`),
            );
            continue;
          }
          updated = {
            ...course,
            criteria: course.criteria.map((cr) =>
              cr.id === crId ? { ...cr, ...action.changes } : cr,
            ),
          };
        } else if (action.type === "add_criterion") {
          const cid = generateClientId();
          const newCr: Criterion = {
            id: cid,
            clientId: cid,
            name: action.criterion.name,
            weight: action.criterion.weight,
            score: action.criterion.score ?? 0,
          };
          updated = {
            ...course,
            criteria: [...course.criteria, newCr],
          };
          lastCriterionId = cid;
        } else if (action.type === "remove_criterion") {
          const crId = resolveCriterionId(course, action.criterionId);
          if (!crId || !course.criteria.some((cr) => cr.id === crId)) {
            result.failed++;
            result.errors.push(`Criterion not found for remove.`);
            continue;
          }
          updated = {
            ...course,
            criteria: course.criteria.filter((cr) => cr.id !== crId),
          };
        } else if (action.type === "add_sub_item") {
          const crId = resolveCriterionId(course, action.criterionId);
          if (!crId || !course.criteria.some((cr) => cr.id === crId)) {
            result.failed++;
            result.errors.push(`Criterion not found for add_sub_item.`);
            continue;
          }
          const sid = generateClientId();
          const newSi: SubItem = {
            id: sid,
            name: action.subItem.name,
            score: action.subItem.score,
            weight: action.subItem.weight,
          };
          updated = {
            ...course,
            criteria: course.criteria.map((cr) =>
              cr.id === crId
                ? { ...cr, subItems: [...(cr.subItems ?? []), newSi] }
                : cr,
            ),
          };
        } else if (action.type === "update_sub_item") {
          const crId = resolveCriterionId(course, action.criterionId);
          if (!crId || !course.criteria.some((cr) => cr.id === crId)) {
            result.failed++;
            result.errors.push(`Criterion not found for update_sub_item.`);
            continue;
          }
          updated = {
            ...course,
            criteria: course.criteria.map((cr) =>
              cr.id === crId
                ? {
                    ...cr,
                    subItems: (cr.subItems ?? []).map((si) =>
                      si.id === action.subItemId
                        ? { ...si, ...action.changes }
                        : si,
                    ),
                  }
                : cr,
            ),
          };
        } else if (action.type === "remove_sub_item") {
          const crId = resolveCriterionId(course, action.criterionId);
          if (!crId || !course.criteria.some((cr) => cr.id === crId)) {
            result.failed++;
            result.errors.push(`Criterion not found for remove_sub_item.`);
            continue;
          }
          updated = {
            ...course,
            criteria: course.criteria.map((cr) =>
              cr.id === crId
                ? {
                    ...cr,
                    subItems: (cr.subItems ?? []).filter(
                      (si) => si.id !== action.subItemId,
                    ),
                  }
                : cr,
            ),
          };
        } else {
          result.failed++;
          result.errors.push(`Unknown action type.`);
          continue;
        }

        // Update local snapshot
        snap = snap.map((s) =>
          s.id === semId
            ? {
                ...s,
                courses: s.courses.map((c) =>
                  c.id === courseId ? updated : c,
                ),
              }
            : s,
        );
        result.applied++;

        // Server sync
        if (isServerResourceId(courseId) && isServerResourceId(semId)) {
          try {
            const synced = await storage.updateCourse(semId, updated);
            snap = snap.map((s) =>
              s.id === semId
                ? {
                    ...s,
                    courses: s.courses.map((c) =>
                      c.id === courseId
                        ? { ...c, criteria: synced.criteria }
                        : c,
                    ),
                  }
                : s,
            );
            setServerOffline(false);
          } catch (error) {
            if (error instanceof ApiUnavailableError) setServerOffline(true);
          }
        }
      } catch (error) {
        console.error("[chat] Batch action error:", action.type, error);
        result.failed++;
        result.errors.push(`Error processing "${action.type}".`);
        if (error instanceof ApiUnavailableError) setServerOffline(true);
      }
    }

    // Final safety check: if nothing actually changed in the data, mark all as failed
    if (result.applied > 0 && JSON.stringify(snap) === originalSnap) {
      console.warn("[chat] Actions reported as applied but data unchanged");
      result.applied = 0;
      result.failed = actions.length;
      result.errors = ["No data was actually changed despite processing actions."];
    }

    // Apply the final snapshot to React state
    setSemesters(snap);
    return result;
  };

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
      {/* AI chat toggle button — hidden when panel is open */}
      {!chatPanelOpen && (
        <div className="fixed right-4 top-4 z-50">
          <Button
            onClick={() => setChatPanelOpen(true)}
            className="flex items-center gap-2 border border-sidebar-border bg-sidebar px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(77,31,26,0.08) 0px, rgba(77,31,26,0.08) 1px, transparent 1px, transparent 20px), repeating-linear-gradient(90deg, rgba(77,31,26,0.08) 0px, rgba(77,31,26,0.08) 1px, transparent 1px, transparent 20px)",
            }}
          >
            <Sparkles className="h-4 w-4" />
            Chat
          </Button>
        </div>
      )}

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

      <div
        className="w-full px-4 py-8 transition-all duration-300 md:pl-[14rem]"
        style={{
          paddingRight: chatPanelOpen ? "17rem" : "2rem",
          paddingLeft: chatPanelOpen ? "17rem" : "19rem",
        }}
      >
        {isDashboardView ? (
          <div className="space-y-6">
            <p className="w-fit mx-auto text-2xl font-bold uppercase tracking-widest bg-primary text-white px-8 py-2 [box-shadow:5px_5px_0_rgba(77,31,26,0.55),10px_10px_0_rgba(77,31,26,0.25)]">
              Dashboard
            </p>
            {dashboardMessage && !isEditingQuote ? (
              <div className="group relative w-full rounded-lg border border-primary/35 bg-card/85 px-4 py-3 text-left shadow-under-white-soft">
                <p className="text-sm italic text-foreground/90">
                  "{dashboardMessage}"
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => setIsEditingQuote(true)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="w-full rounded-lg border border-primary/35 bg-card/85 p-3 text-left shadow-under-white-soft">
                <p className="text-xs text-muted-foreground">
                  Save a quote you want to see every time you open your
                  dashboard.
                </p>
                <textarea
                  value={dashboardMessageDraft}
                  onChange={(event) =>
                    setDashboardMessageDraft(event.target.value)
                  }
                  placeholder="Your motivational quote..."
                  rows={2}
                  maxLength={280}
                  className="mt-2 w-full resize-y rounded-md border border-primary/25 bg-background/90 px-3 py-1.5 text-sm text-foreground outline-none transition focus:border-primary/45"
                />
                <div className="mt-2 flex items-center gap-2">
                  <Button size="sm" onClick={saveDashboardMessage}>
                    Save message
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

            {semesters.length === 0 ? (
              <div className="rounded-lg border border-dashed border-primary/30 bg-card/60 p-6 text-center text-sm text-muted-foreground">
                Add your first semester to populate the dashboard.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg border border-primary/35 bg-card/85 p-4 text-left shadow-under-white-soft">
                    <p className="text-sm text-muted-foreground">Overall GPA</p>
                    <p className="mt-2 flex items-baseline gap-2 text-3xl font-bold text-primary">
                      <TrendingUp className="h-5 w-5 text-muted-foreground" />
                      {overallGpa.toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-primary/35 bg-card/85 p-4 text-left shadow-under-white-soft">
                    <p className="text-sm text-muted-foreground">
                      Total Credits
                    </p>
                    <p className="mt-2 flex items-baseline gap-2 text-3xl font-bold text-primary">
                      <Layers className="h-5 w-5 text-muted-foreground" />
                      {totalCredits}
                    </p>
                  </div>
                  <div className="rounded-lg border border-primary/35 bg-card/85 p-4 text-left shadow-under-white-soft">
                    <p className="text-sm text-muted-foreground">
                      Semesters Tracked
                    </p>
                    <p className="mt-2 text-3xl font-bold text-primary">
                      {totalSemesters}
                    </p>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <GpaTimelineChart data={timelineData} />
                  {allCourses.length > 0 ? (
                    <GradeDistributionChart
                      title="Overall Grade Distribution"
                      courses={allCourses}
                    />
                  ) : (
                    <div className="rounded-lg border bg-card/85 p-4 text-left border-2 border-primary/35 shadow-under-white-strong text-lg text-muted-foreground">
                      Add your courses to see grade distributions!
                    </div>
                  )}
                </div>

                <div className="grid p-4 gap-4 lg:grid">
                  {semesterSummaries.map((summary) => (
                    <div
                      key={summary.id}
                      className="rounded-lg border border-primary/35 bg-card/85 p-4 text-left shadow-under-white-soft"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {summary.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateLabel(summary.createdAt)}
                          </p>
                        </div>
                        <span className="text-lg font-bold text-primary">
                          {summary.gpa.toFixed(2)} GPA
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Credits: {summary.credits}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2">
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
                  onClick={() => setIsEditingSemesterName(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="group flex items-center justify-center gap-6">
                <p className="w-fit text-2xl font-bold uppercase tracking-widest bg-primary text-white px-8 py-2 [box-shadow:5px_5px_0_rgba(77,31,26,0.55),10px_10px_0_rgba(77,31,26,0.25)]">
                  {activeSemester?.name ?? "Semester"}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                  title="Edit name"
                  onClick={() => {
                    setSemesterNameDraft(activeSemester?.name ?? "");
                    setIsEditingSemesterName(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        )}

        {!isDashboardView && courses.length > 0 && (
          <div className="mb-8 grid gap-6 md:grid-cols-2">
            <GpaSummary courses={courses} />
            <GradeDistributionChart courses={courses} />
          </div>
        )}

        {!isDashboardView && activeSemesterId && (
          <AnimatePresence mode="popLayout">
            <div className="space-y-6">
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
                  <CourseCard
                    course={course}
                    onUpdate={(courseId, nextCourse) =>
                      updateCourse(courseId, nextCourse)
                    }
                    onDelete={deleteCourse}
                    onExportCourse={exportCourseToJson}
                    onDuplicate={() => duplicateCourse(course.id)}
                  />
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}

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

        {semesters.length === 0 && (
          <div className="mt-12 text-center">
            <p className="mb-4 text-muted-foreground">
              No semesters yet. Click "Add Semester" to get started!
            </p>
            <Button onClick={addSemester} size="lg" className="gap-2">
              <Plus className="h-5 w-5" />
              Add Semester
            </Button>
          </div>
        )}

        {activeSemesterId && courses.length === 0 && (
          <div className="mt-12 text-center">
            <p className="text-muted-foreground">
              No courses in this semester. Click "Add Course" to get started!
            </p>
          </div>
        )}
      </div>

      <ChatPanel
        open={chatPanelOpen}
        onOpenChange={setChatPanelOpen}
        semesters={semesters}
        activeSemesterId={activeSemesterId}
        onApplyActions={handleChatActions}
        onOpenSyllabusImport={() => setSyllabusImportOpen(true)}
      />

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
