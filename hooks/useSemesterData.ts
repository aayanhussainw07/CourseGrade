"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import type { Course, Semester } from "@/lib/types";
import type { CoursePortableData } from "@/lib/csv";
import { storage, ApiUnavailableError } from "@/lib/storage";
import {
  serializeCourseCsv,
  serializeSemesterCsv,
  parseCourseCsv,
  parseSemesterCsv,
} from "@/lib/csv";
import {
  applyStoredSettingsToSemesters,
  persistCourseSettings,
  removeCourseSettings,
} from "@/lib/course-settings";
import { calculateGPA } from "@/lib/grade-utils";
import {
  ACTIVE_SEMESTER_STORAGE_KEY,
  COURSE_SETTINGS_STORAGE_KEY,
  DASHBOARD_SENTINEL,
  type DashboardBackupPayload,
  courseToPortable,
  generateClientId,
  getGpaColor,
  gpaToLetterGrade,
  isServerResourceId,
  parseSemesterSortValue,
  readStoredSemesterOrder,
  safeFilename,
  sanitizeSemesters,
  triggerFileDownload,
  writeStoredSemesterOrder,
} from "@/app/page-utils";
import { useUndoRedo } from "./useUndoRedo";
import type { AppSettings } from "@/lib/app-settings";
import { getRandomHeaderColor } from "@/lib/header-colors";
import {
  SAVE_ERROR_DURATION_MS,
  SAVE_SUCCESS_DURATION_MS,
} from "@/lib/constants";

export function useSemesterData({ appSettings }: { appSettings: AppSettings }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const routeSemesterId = useMemo(() => {
    if (pathname === "/dashboard") return null;
    const match = pathname.match(/^\/semesters\/(.+)$/);
    return match ? match[1] : undefined;
  }, [pathname]);

  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [semesterOrder, setSemesterOrder] = useState<string[]>([]);
  const [activeSemesterId, setActiveSemesterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverOffline, setServerOffline] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataLoadedRef = useRef(false);

  const [ignoredSemesterIds, setIgnoredSemesterIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("ignored_semester_ids");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleSemesterIgnore = useCallback((semesterId: string) => {
    setIgnoredSemesterIds((prev) => {
      const next = new Set(prev);
      if (next.has(semesterId)) next.delete(semesterId);
      else next.add(semesterId);
      try {
        localStorage.setItem("ignored_semester_ids", JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }, []);

  const { handleUndo, handleRedo } = useUndoRedo({
    semesters,
    semesterOrder,
    activeSemesterId,
    setSemesters,
    setSemesterOrder,
    setActiveSemesterId,
    loading,
  });

  // Keep semesterOrder in sync with semesters list
  useEffect(() => {
    setSemesterOrder((previous) => {
      if (semesters.length === 0) return [];
      const semesterIds = semesters.map((s) => s.id);
      const filtered = previous.filter((id) => semesterIds.includes(id));
      const missing = semesterIds.filter((id) => !filtered.includes(id));
      if (missing.length === 0 && filtered.length === previous.length) return previous;
      return [...filtered, ...missing];
    });
  }, [semesters]);

  // Persist semesterOrder to localStorage
  useEffect(() => {
    if (semesterOrder.length === 0) return;
    writeStoredSemesterOrder(semesterOrder);
  }, [semesterOrder]);

  // Persist activeSemesterId to localStorage
  useEffect(() => {
    localStorage.setItem(
      ACTIVE_SEMESTER_STORAGE_KEY,
      activeSemesterId === null ? DASHBOARD_SENTINEL : activeSemesterId,
    );
  }, [activeSemesterId]);

  // Update document title
  useEffect(() => {
    if (loading) return;
    const activeSemester = semesters.find((s) => s.id === activeSemesterId);
    if (activeSemesterId === null) document.title = "Dashboard";
    else if (activeSemester) document.title = activeSemester.name;
    else document.title = "CourseGrade";
  }, [activeSemesterId, semesters, loading]);

  // Redirect unauthenticated users
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/");
  }, [status, router]);

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
        const validOrder = savedOrder.filter((id) => mergedSemesters.some((s) => s.id === id));
        if (validOrder.length > 0) setSemesterOrder(validOrder);
      }

      if (urlSemesterId !== undefined) {
        if (urlSemesterId === null) {
          setActiveSemesterId(null);
        } else if (loadedSemesters.find((s) => s.id === urlSemesterId)) {
          setActiveSemesterId(urlSemesterId);
        } else if (loadedSemesters.length > 0) {
          setActiveSemesterId(loadedSemesters[0].id);
        }
      } else {
        const saved = localStorage.getItem(ACTIVE_SEMESTER_STORAGE_KEY);
        if (saved === DASHBOARD_SENTINEL) {
          setActiveSemesterId(null);
        } else if (saved && loadedSemesters.find((s) => s.id === saved)) {
          setActiveSemesterId(saved);
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

  // Load data on auth state change
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
    if (routeSemesterId !== undefined) setActiveSemesterId(routeSemesterId);
  }, [routeSemesterId]);

  useEffect(() => {
    if (!loading) dataLoadedRef.current = true;
  }, [loading]);

  // ── Computed ──────────────────────────────────────────────────────────────

  const activeSemester = useMemo(
    () => semesters.find((s) => s.id === activeSemesterId),
    [semesters, activeSemesterId],
  );
  const courses = activeSemester?.courses ?? [];
  const isDashboardView = activeSemesterId === null;

  const orderedSemesters = useMemo(() => {
    if (semesterOrder.length === 0) {
      return [...semesters].sort((a, b) => parseSemesterSortValue(a) - parseSemesterSortValue(b));
    }
    const map = new Map(semesters.map((s) => [s.id, s]));
    const ordered = semesterOrder.map((id) => map.get(id)).filter((s): s is Semester => Boolean(s));
    if (ordered.length === semesters.length) return ordered;
    const missing = semesters.filter((s) => !semesterOrder.includes(s.id));
    return [...ordered, ...missing];
  }, [semesterOrder, semesters]);

  const activeSemesters = useMemo(
    () => orderedSemesters.filter((s) => !ignoredSemesterIds.has(s.id)),
    [orderedSemesters, ignoredSemesterIds],
  );

  const allCourses = useMemo(
    () => activeSemesters.flatMap((s) => (Array.isArray(s.courses) ? s.courses : [])),
    [activeSemesters],
  );

  const overallGpa = useMemo(
    () => (allCourses.length > 0 ? calculateGPA(allCourses, appSettings.aPlusGpaValue) : 0),
    [allCourses, appSettings.aPlusGpaValue],
  );

  const overallGpaLetter = useMemo(
    () => gpaToLetterGrade(overallGpa, appSettings.aPlusGpaValue),
    [overallGpa, appSettings.aPlusGpaValue],
  );

  const totalCredits = useMemo(
    () => allCourses.reduce((sum, c) => sum + c.credits, 0),
    [allCourses],
  );

  const totalSemesters = activeSemesters.length;

  const semesterSummaries = useMemo(
    () =>
      activeSemesters.map((semester) => {
        const coursesList = Array.isArray(semester.courses) ? semester.courses : [];
        const credits = coursesList.reduce((sum, c) => sum + c.credits, 0);
        const gpa =
          coursesList.length > 0 ? calculateGPA(coursesList, appSettings.aPlusGpaValue) : 0;
        return {
          id: semester.id,
          name: semester.name,
          gpa,
          credits,
          createdAt: semester.createdAt ?? semester.updatedAt ?? "",
        };
      }),
    [activeSemesters, appSettings.aPlusGpaValue],
  );

  const timelineData = useMemo(
    () =>
      semesterSummaries.map((s) => {
        const gpaValue = Number(s.gpa.toFixed(2));
        return { label: s.name, gpa: gpaValue, color: getGpaColor(gpaValue) };
      }),
    [semesterSummaries],
  );

  const dashboardSummary = useMemo(
    () => ({ overallGpa, totalCredits, totalSemesters }),
    [overallGpa, totalCredits, totalSemesters],
  );

  // ── importPortableCourse (shared by many operations) ──────────────────────

  const importPortableCourse = useCallback(
    async (courseData: CoursePortableData, semesterId: string): Promise<Course> => {
      const numericOr = (value: number | undefined, fallback: number) =>
        typeof value === "number" && Number.isFinite(value) ? value : fallback;
      const fallbackName =
        typeof courseData.name === "string" && courseData.name.length > 0
          ? courseData.name
          : "Imported Course";
      const baseCourse = await storage.createCourse(
        semesterId,
        fallbackName,
        numericOr(courseData.credits, 0),
        courseData.headerColor ?? null,
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
          dropLowest: Math.max(0, Math.floor(numericOr(criterion.dropLowest, 0))),
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
        passThreshold: numericOr(courseData.passThreshold, baseCourse.passThreshold ?? 60),
        headerColor: courseData.headerColor ?? baseCourse.headerColor ?? null,
        percentBoost: Math.max(
          0,
          Math.min(100, numericOr(courseData.percentBoost, baseCourse.percentBoost ?? 0)),
        ),
        gradeScale:
          courseData.gradeScale && courseData.gradeScale.length > 0
            ? courseData.gradeScale
            : baseCourse.gradeScale,
        criteria: normalizedCriteria.length > 0 ? normalizedCriteria : baseCourse.criteria,
      };

      const syncedCourse = await storage.updateCourse(semesterId, updatedCourse);
      persistCourseSettings(syncedCourse);
      return syncedCourse;
    },
    [],
  );

  // ── Semester CRUD ─────────────────────────────────────────────────────────

  const addSemester = useCallback(async () => {
    try {
      const newSemester = await storage.createSemester(`Semester ${semesters.length + 1}`);
      setSemesters((prev) => [...prev, newSemester]);
      setActiveSemesterId(newSemester.id);
      router.push("/semesters/" + newSemester.id);
      setServerOffline(false);
    } catch (error) {
      if (error instanceof ApiUnavailableError) setServerOffline(true);
      else console.error("[v0] Failed to create semester:", error);
    }
  }, [semesters.length, router]);

  const deleteSemester = useCallback(
    async (semesterId: string) => {
      try {
        await storage.deleteSemester(semesterId);
        setSemesters((prev) => {
          const updated = prev.filter((s) => s.id !== semesterId);
          if (activeSemesterId === semesterId) {
            const nextId = updated.length > 0 ? updated[0].id : null;
            setActiveSemesterId(nextId);
            router.push(nextId ? "/semesters/" + nextId : "/dashboard");
          }
          return updated;
        });
        setServerOffline(false);
      } catch (error) {
        if (error instanceof ApiUnavailableError) setServerOffline(true);
        else console.error("[v0] Failed to delete semester:", error);
      }
    },
    [activeSemesterId, router],
  );

  const editSemester = useCallback(async (semesterId: string, newName: string) => {
    try {
      await storage.updateSemester(semesterId, { name: newName });
      setSemesters((prev) => prev.map((s) => (s.id === semesterId ? { ...s, name: newName } : s)));
      setServerOffline(false);
    } catch (error) {
      if (error instanceof ApiUnavailableError) setServerOffline(true);
      else console.error("[v0] Failed to update semester:", error);
    }
  }, []);

  const clearAllData = useCallback(async () => {
    for (const s of semesters) {
      try { await storage.deleteSemester(s.id); } catch { /* best effort */ }
    }
    setSemesters([]);
    setActiveSemesterId(null);
    localStorage.removeItem(COURSE_SETTINGS_STORAGE_KEY);
  }, [semesters]);

  // ── Course CRUD ───────────────────────────────────────────────────────────

  // Returns the created course so layout.tsx can scroll to it
  const addCourse = useCallback(async (): Promise<Course | null> => {
    if (!activeSemesterId) return null;
    try {
      const headerColor = getRandomHeaderColor();
      const newCourse = await storage.createCourse(
        activeSemesterId,
        `Course ${courses.length + 1}`,
        appSettings.defaultCredits,
        headerColor,
      );
      newCourse.gradeScale = appSettings.defaultGradeScale.map((g) => ({ ...g }));
      newCourse.isPassFail = appSettings.defaultIsPassFail;
      newCourse.passLabel = appSettings.defaultPassLabel;
      newCourse.failLabel = appSettings.defaultFailLabel;
      newCourse.passThreshold = appSettings.defaultPassThreshold;
      newCourse.gradeScaleSnapshot = appSettings.defaultIsPassFail
        ? appSettings.defaultGradeScaleSnapshot?.map((g) => ({ ...g }))
        : undefined;
      newCourse.headerColor = headerColor;
      newCourse.collapsed = true;
      persistCourseSettings(newCourse);
      setSemesters((prev) =>
        prev.map((s) =>
          s.id === activeSemesterId ? { ...s, courses: [...s.courses, newCourse] } : s,
        ),
      );
      setServerOffline(false);
      return newCourse;
    } catch (error) {
      if (error instanceof ApiUnavailableError) setServerOffline(true);
      else console.error("[v0] Failed to create course:", error);
      return null;
    }
  }, [
    activeSemesterId,
    courses.length,
    appSettings.defaultCredits,
    appSettings.defaultFailLabel,
    appSettings.defaultGradeScale,
    appSettings.defaultGradeScaleSnapshot,
    appSettings.defaultIsPassFail,
    appSettings.defaultPassLabel,
    appSettings.defaultPassThreshold,
  ]);

  const updateCourse = useCallback(
    async (id: string, updatedCourse: Course) => {
      if (!activeSemesterId) return;
      const baseCriteria = Array.isArray(updatedCourse.criteria) ? updatedCourse.criteria : [];
      const normalizedPercentBoost = Math.max(
        0,
        Math.min(
          100,
          Number.isFinite(updatedCourse.percentBoost ?? 0) ? (updatedCourse.percentBoost ?? 0) : 0,
        ),
      );
      const stateCriteria = baseCriteria.map((c) => ({
        ...c,
        name: typeof c.name === "string" ? c.name : "",
        subItems: Array.isArray(c.subItems) ? c.subItems : [],
      }));
      const stateCourse: Course = {
        ...updatedCourse,
        name: typeof updatedCourse.name === "string" ? updatedCourse.name : "",
        percentBoost: normalizedPercentBoost,
        criteria: stateCriteria,
      };
      const sanitizedCriteria = stateCriteria.map((c) => ({
        ...c,
        name: c.name.length > 0 ? c.name : "",
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
              ? { ...s, courses: s.courses.map((c) => (c.id === id ? nextCourse : c)) }
              : s,
          ),
        );
      };

      applyCourseUpdate(stateCourse);
      persistCourseSettings(sanitizedCourse);

      if (!isServerResourceId(id) || !isServerResourceId(activeSemesterId)) {
        console.warn("[v0] Skipping course sync until course and semester have server IDs.");
        return;
      }

      setSaveStatus("saving");
      try {
        const syncedCourse = await storage.updateCourse(activeSemesterId, sanitizedCourse);
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
          SAVE_SUCCESS_DURATION_MS,
        );
      } catch (error) {
        setSaveStatus("error");
        if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
        saveStatusTimerRef.current = setTimeout(
          () => setSaveStatus("idle"),
          SAVE_ERROR_DURATION_MS,
        );
        if (error instanceof ApiUnavailableError) setServerOffline(true);
        else console.error("[v0] Failed to update course:", error);
      }
    },
    [activeSemesterId],
  );

  const deleteCourse = useCallback(
    async (id: string) => {
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
        if (error instanceof ApiUnavailableError) setServerOffline(true);
        else console.error("[v0] Failed to delete course:", error);
      }
    },
    [activeSemesterId],
  );

  // Returns duplicated course so layout.tsx can scroll to it
  const duplicateCourse = useCallback(
    async (courseId: string): Promise<Course | null> => {
      if (!activeSemesterId) return null;
      const course = courses.find((c) => c.id === courseId);
      if (!course) return null;
      try {
        const duplicated = await importPortableCourse(courseToPortable(course), activeSemesterId);
        setSemesters((prev) =>
          prev.map((s) =>
            s.id === activeSemesterId ? { ...s, courses: [...s.courses, duplicated] } : s,
          ),
        );
        setServerOffline(false);
        return duplicated;
      } catch (error) {
        if (error instanceof ApiUnavailableError) setServerOffline(true);
        else console.error("[v0] Failed to duplicate course:", error);
        return null;
      }
    },
    [activeSemesterId, courses, importPortableCourse],
  );

  const collapseAllCourses = useCallback(() => {
    if (!activeSemesterId) return;
    setSemesters((prev) =>
      prev.map((s) =>
        s.id === activeSemesterId
          ? { ...s, courses: s.courses.map((c) => ({ ...c, collapsed: true })) }
          : s,
      ),
    );
  }, [activeSemesterId]);

  const expandAllCourses = useCallback(() => {
    if (!activeSemesterId) return;
    setSemesters((prev) =>
      prev.map((s) =>
        s.id === activeSemesterId
          ? { ...s, courses: s.courses.map((c) => ({ ...c, collapsed: false })) }
          : s,
      ),
    );
  }, [activeSemesterId]);

  const handleReorderSemesters = useCallback((orderedIds: string[]) => {
    if (orderedIds.length === 0) return;
    setSemesterOrder(orderedIds);
    setSemesters((previous) => {
      const map = new Map(previous.map((s) => [s.id, s]));
      const reordered = orderedIds.map((id) => map.get(id)).filter((s): s is Semester => Boolean(s));
      if (reordered.length === previous.length) return reordered;
      return [...reordered, ...previous.filter((s) => !orderedIds.includes(s.id))];
    });
  }, []);

  const handleReorderCourses = useCallback((semesterId: string, orderedCourseIds: string[]) => {
    if (!semesterId || orderedCourseIds.length === 0) return;
    setSemesters((previous) =>
      previous.map((semester) => {
        if (semester.id !== semesterId) return semester;
        const map = new Map(semester.courses.map((c) => [c.id, c]));
        const reordered = orderedCourseIds
          .map((id) => map.get(id))
          .filter((c): c is Course => Boolean(c));
        if (reordered.length === semester.courses.length) return { ...semester, courses: reordered };
        return {
          ...semester,
          courses: [
            ...reordered,
            ...semester.courses.filter((c) => !orderedCourseIds.includes(c.id)),
          ],
        };
      }),
    );
  }, []);

  const editCourse = useCallback(
    async (courseId: string, newName: string) => {
      const course = courses.find((c) => c.id === courseId);
      if (course) await updateCourse(courseId, { ...course, name: newName });
    },
    [courses, updateCourse],
  );

  // ── Import / Export ───────────────────────────────────────────────────────

  // Returns imported course so layout.tsx can scroll to it
  const importCourseFromSyllabus = useCallback(
    async (data: CoursePortableData, semesterId: string): Promise<Course | null> => {
      try {
        const importedCourse = await importPortableCourse(data, semesterId);
        setSemesters((prev) =>
          prev.map((s) =>
            s.id === semesterId ? { ...s, courses: [...s.courses, importedCourse] } : s,
          ),
        );
        setServerOffline(false);
        return importedCourse;
      } catch (error) {
        if (error instanceof ApiUnavailableError) setServerOffline(true);
        else console.error("[v0] Failed to import syllabus course:", error);
        return null;
      }
    },
    [importPortableCourse],
  );

  const exportSemesterToJson = useCallback(
    (semesterId: string) => {
      const semester = semesters.find((s) => s.id === semesterId);
      if (!semester) return;
      triggerFileDownload(
        `${safeFilename(semester.name, "semester")}.json`,
        serializeSemesterCsv(semester),
      );
    },
    [semesters],
  );

  const exportCourseToJson = useCallback(
    (courseId: string) => {
      for (const semester of semesters) {
        const course = semester.courses.find((c) => c.id === courseId);
        if (course) {
          triggerFileDownload(
            `${safeFilename(course.name, "course")}.json`,
            serializeCourseCsv(course),
          );
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
      semesters: semesters.map((s) => ({
        id: s.id,
        name: s.name,
        background: s.background,
        timelineDate: s.timelineDate ?? null,
        courses: s.courses.map(courseToPortable),
      })),
    };
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    triggerFileDownload(
      `coursegrade-dashboard-${timestamp}.json`,
      JSON.stringify(payload, null, 2),
    );
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
          await storage.updateSemester(created.id, { name: desiredName, background });
        }
        const importedCourses: Course[] = [];
        for (const courseData of data.courses ?? []) {
          importedCourses.push(await importPortableCourse(courseData, created.id));
        }
        const merged: Semester = { ...created, name: desiredName, background, courses: importedCourses };
        setSemesters((prev) => [...prev, merged]);
        setActiveSemesterId(merged.id);
        router.push("/semesters/" + merged.id);
        setServerOffline(false);
      } catch (error) {
        if (error instanceof ApiUnavailableError) setServerOffline(true);
        else console.error("[v0] Failed to import semester JSON:", error);
      }
    },
    [importPortableCourse, semesters.length, router],
  );

  const importCourseFromJson = useCallback(
    async (file: File, semesterId: string | null) => {
      if (!semesterId) return;
      try {
        const text = await file.text();
        const importedCourse = await importPortableCourse(parseCourseCsv(text), semesterId);
        setSemesters((prev) =>
          prev.map((s) =>
            s.id === semesterId ? { ...s, courses: [...s.courses, importedCourse] } : s,
          ),
        );
        setServerOffline(false);
      } catch (error) {
        if (error instanceof ApiUnavailableError) setServerOffline(true);
        else console.error("[v0] Failed to import course JSON:", error);
      }
    },
    [importPortableCourse],
  );

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
            if (typeof oldId === "string") orderMap.set(oldId, index);
          });
        }
        const createdSemesters: Array<{ semester: Semester; orderIndex: number }> = [];
        for (const [index, semesterData] of payload.semesters.entries()) {
          const safeName =
            typeof semesterData?.name === "string" && semesterData.name.length > 0
              ? semesterData.name
              : `Imported Semester ${semesters.length + createdSemesters.length + 1}`;
          const created = await storage.createSemester(safeName, semesterData?.timelineDate ?? null);
          const background = semesterData?.background ?? created.background;
          if (
            background !== created.background ||
            safeName !== created.name ||
            (semesterData?.timelineDate ?? null) !== (created.timelineDate ?? null)
          ) {
            await storage.updateSemester(created.id, {
              name: safeName,
              background,
              timelineDate: semesterData?.timelineDate ?? null,
            });
          }
          const importedCourses: Course[] = [];
          for (const courseData of semesterData?.courses ?? []) {
            importedCourses.push(await importPortableCourse(courseData, created.id));
          }
          const semesterRecord: Semester = {
            ...created,
            name: safeName,
            background,
            timelineDate: semesterData?.timelineDate ?? created.timelineDate ?? null,
            courses: importedCourses,
          };
          const orderIndex =
            (typeof semesterData?.id === "string" && orderMap.has(semesterData.id)
              ? orderMap.get(semesterData.id)
              : undefined) ?? index;
          createdSemesters.push({ semester: semesterRecord, orderIndex });
        }
        if (createdSemesters.length > 0) {
          const orderedImports = createdSemesters
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((e) => e.semester);
          setSemesters((prev) => [...prev, ...orderedImports]);
          setSemesterOrder((prev) => [...prev, ...orderedImports.map((s) => s.id)]);
          setActiveSemesterId(orderedImports[0].id);
          router.push("/semesters/" + orderedImports[0].id);
        }
        setServerOffline(false);
      } catch (error) {
        if (error instanceof ApiUnavailableError) setServerOffline(true);
        else console.error("[v0] Failed to import dashboard backup:", error);
      }
    },
    [importPortableCourse, semesters.length, router],
  );

  return {
    // Auth
    session,
    status,
    // State
    semesters,
    setSemesters,
    semesterOrder,
    setSemesterOrder,
    activeSemesterId,
    setActiveSemesterId,
    loading,
    serverOffline,
    saveStatus,
    // Computed
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
    // Undo/Redo
    handleUndo,
    handleRedo,
    // Data loading
    loadSemesters,
    // Semester CRUD
    addSemester,
    deleteSemester,
    editSemester,
    clearAllData,
    // Course CRUD
    addCourse,
    updateCourse,
    deleteCourse,
    duplicateCourse,
    importCourseFromSyllabus,
    collapseAllCourses,
    expandAllCourses,
    editCourse,
    handleReorderSemesters,
    handleReorderCourses,
    // Ignored semesters
    ignoredSemesterIds,
    toggleSemesterIgnore,
    // Import/Export
    importSemesterFromJson,
    importCourseFromJson,
    importDashboardBackup,
    exportSemesterToJson,
    exportCourseToJson,
    exportDashboardBackup,
  };
}
