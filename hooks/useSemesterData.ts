"use client";

import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
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
import { migrateLegacyBrowserState } from "@/lib/local-cloud-migration";
import {
  buildDefaultCourseGrading,
  calculateGPA,
  normalizeGradeScaleMetadata,
} from "@/lib/grade-utils";
import {
  type DashboardBackupPayload,
  courseToPortable,
  generateClientId,
  getGpaColor,
  gpaToLetterGrade,
  isServerResourceId,
  parseSemesterSortValue,
  safeFilename,
  sanitizeSemesters,
  triggerFileDownload,
} from "@/app/page-utils";
import { useUndoRedo } from "./useUndoRedo";
import type { AppSettings } from "@/lib/app-settings";
import { serializeAllGradesCsv } from "@/lib/data-export";
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
  const [dashboardMessage, setDashboardMessage] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const courseSaveQueuesRef = useRef<Map<string, Promise<void>>>(new Map());
  const courseSaveVersionsRef = useRef<Map<string, number>>(new Map());
  const syncedCriterionIdsRef = useRef<
    Map<string, Map<string, string>>
  >(new Map());
  const dataLoadedRef = useRef(false);
  const defaultGradeScaleRef = useRef(appSettings.defaultGradeScale);
  const appliedCourseOpenStateRef = useRef<string | null>(null);

  const ignoredSemesterIds = useMemo(
    () => new Set(semesters.filter((s) => s.ignored).map((s) => s.id)),
    [semesters],
  );

  useEffect(() => {
    defaultGradeScaleRef.current = appSettings.defaultGradeScale;
  }, [appSettings.defaultGradeScale]);

  const toggleSemesterIgnore = useCallback(async (semesterId: string) => {
    if (serverOffline) return;
    const target = semesters.find((s) => s.id === semesterId);
    if (!target) return;
    const nextIgnored = !target.ignored;
    // Optimistic update
    setSemesters((prev) =>
      prev.map((s) => (s.id === semesterId ? { ...s, ignored: nextIgnored } : s)),
    );
    try {
      await storage.updateSemester(semesterId, { ignored: nextIgnored });
      setServerOffline(false);
    } catch (error) {
      // Revert on failure
      setSemesters((prev) =>
        prev.map((s) => (s.id === semesterId ? { ...s, ignored: !nextIgnored } : s)),
      );
      if (error instanceof ApiUnavailableError) setServerOffline(true);
      else console.error("[v0] Failed to toggle semester ignore:", error);
    }
  }, [semesters, serverOffline]);

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

  useEffect(() => {
    if (!dataLoadedRef.current || status !== "authenticated" || serverOffline) return;
    void storage
      .updateUserState({
        last_active_semester_id: activeSemesterId === null ? null : Number(activeSemesterId),
      })
      .catch((error) => {
        if (error instanceof ApiUnavailableError) setServerOffline(true);
        else console.error("[v0] Failed to save active semester:", error);
      });
  }, [activeSemesterId, serverOffline, status]);

  // Update document title
  useEffect(() => {
    if (loading) return;
    const activeSemester = semesters.find((s) => s.id === activeSemesterId);
    if (pathname === "/settings") document.title = "Settings | CourseGrade";
    else if (activeSemesterId === null) document.title = "Dashboard";
    else if (activeSemester) document.title = activeSemester.name;
    else document.title = "CourseGrade";
  }, [activeSemesterId, semesters, loading, pathname]);

  // Redirect unauthenticated users
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/");
  }, [status, router]);

  const loadSemesters = useCallback(async (
    urlSemesterId?: string | null,
    explicitScopeId?: string,
  ) => {
    const hydrateCourses = (loaded: Semester[]) => loaded.map((semester) => ({
      ...semester,
      courses: semester.courses.map((course) => ({
        ...course,
        gradeScale: normalizeGradeScaleMetadata(course.gradeScale, 4.33, defaultGradeScaleRef.current),
        gradeScaleSnapshot: course.gradeScaleSnapshot
          ? normalizeGradeScaleMetadata(course.gradeScaleSnapshot, 4.33, defaultGradeScaleRef.current)
          : undefined,
        collapsed: true,
      })),
    }))
    try {
      setLoading(true);
      setServerOffline(false);
      let loadedSemesters = await storage.getSemesters();
      const scopeId = explicitScopeId || session?.user?.id || session?.user?.email || "default";
      const migratedState = await migrateLegacyBrowserState(loadedSemesters, scopeId);
      if (migratedState.migrated) {
        loadedSemesters = await storage.getSemesters();
      }
      setDashboardMessage(migratedState.dashboardMessage ?? "");
      setSemesters(
        hydrateCourses(loadedSemesters),
      );
      setSemesterOrder(loadedSemesters.map((semester) => semester.id));

      if (urlSemesterId !== undefined) {
        if (urlSemesterId === null) {
          setActiveSemesterId(null);
        } else if (loadedSemesters.find((s) => s.id === urlSemesterId)) {
          setActiveSemesterId(urlSemesterId);
        } else if (loadedSemesters.length > 0) {
          const fallbackSemesterId = loadedSemesters[0].id;
          setActiveSemesterId(fallbackSemesterId);
          router.replace(`/semesters/${fallbackSemesterId}`);
        }
      } else {
        const saved = migratedState.activeSemesterId;
        setActiveSemesterId(saved && loadedSemesters.some((s) => s.id === saved) ? saved : null);
      }
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        console.error("[v0] Server offline while loading semesters.");
        setServerOffline(true);
        const cached = storage.getCachedSemesters();
        const cachedUserState = storage.getCachedUserState();
        setSemesters(hydrateCourses(cached));
        setSemesterOrder(cached.map((semester) => semester.id));
        setDashboardMessage(cachedUserState?.dashboard_message ?? "");
        if (typeof urlSemesterId === "string" && cached.some((semester) => semester.id === urlSemesterId)) {
          setActiveSemesterId(urlSemesterId);
        } else if (urlSemesterId === null) {
          setActiveSemesterId(null);
        } else {
          const cachedActiveId = cachedUserState?.last_active_semester_id?.toString() ?? null;
          setActiveSemesterId(
            cachedActiveId && cached.some((semester) => semester.id === cachedActiveId)
              ? cachedActiveId
              : null,
          );
        }
      } else {
        console.error("[v0] Failed to load semesters:", error);
      }
    } finally {
      setLoading(false);
    }
  }, [router, session?.user?.email, session?.user?.id]);

  // Load data on auth state change
  useEffect(() => {
    if (status === "authenticated") {
      const scopeId = session?.user?.id || session?.user?.email || "default";
      storage.setUserScope(scopeId);
      loadSemesters(routeSemesterId, scopeId);
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
    if (routeSemesterId === undefined) return;
    if (routeSemesterId === null) {
      setActiveSemesterId(null);
      return;
    }
    if (semesters.some((semester) => semester.id === routeSemesterId)) {
      setActiveSemesterId(routeSemesterId);
      return;
    }
    if (semesters.length > 0) {
      const fallbackSemesterId = semesters[0].id;
      setActiveSemesterId(fallbackSemesterId);
      router.replace(`/semesters/${fallbackSemesterId}`);
    }
  }, [routeSemesterId, router, semesters]);

  useEffect(() => {
    if (!loading) dataLoadedRef.current = true;
  }, [loading]);

  useLayoutEffect(() => {
    if (loading) return;
    if (typeof routeSemesterId !== "string") {
      appliedCourseOpenStateRef.current = null;
      return;
    }

    const shouldCollapse = appSettings.collapseCoursesOnSemesterOpen;
    const applicationKey = `${routeSemesterId}:${shouldCollapse}`;
    if (appliedCourseOpenStateRef.current === applicationKey) return;
    appliedCourseOpenStateRef.current = applicationKey;

    setSemesters((previous) => {
      let changed = false;
      const next = previous.map((semester) => {
        if (semester.id !== routeSemesterId) return semester;
        const courses = semester.courses.map((course) => {
          if (course.collapsed === shouldCollapse) return course;
          changed = true;
          return { ...course, collapsed: shouldCollapse };
        });
        return changed ? { ...semester, courses } : semester;
      });
      return changed ? next : previous;
    });
  }, [
    appSettings.collapseCoursesOnSemesterOpen,
    loading,
    routeSemesterId,
  ]);

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
    () => (allCourses.length > 0 ? calculateGPA(allCourses) : 0),
    [allCourses],
  );

  const overallGpaLetter = useMemo(
    () => gpaToLetterGrade(overallGpa),
    [overallGpa],
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
          coursesList.length > 0 ? calculateGPA(coursesList) : 0;
        return {
          id: semester.id,
          name: semester.name,
          gpa,
          credits,
          createdAt: semester.createdAt ?? semester.updatedAt ?? "",
        };
      }),
    [activeSemesters],
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

  const saveDashboardMessage = useCallback(async (value: string) => {
    if (serverOffline) return;
    const normalized = value.trim().slice(0, 240);
    try {
      const state = await storage.updateUserState({ dashboard_message: normalized || null });
      setDashboardMessage(state.dashboard_message ?? "");
      setServerOffline(false);
    } catch (error) {
      if (error instanceof ApiUnavailableError) setServerOffline(true);
      else console.error("[v0] Failed to save dashboard message:", error);
      throw error;
    }
  }, [serverOffline]);

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
        passColor: courseData.passColor ?? baseCourse.passColor ?? "#888888",
        failColor: courseData.failColor ?? baseCourse.failColor ?? "#8a8a8a",
        headerColor: courseData.headerColor ?? baseCourse.headerColor ?? null,
        percentBoost: Math.max(
          0,
          Math.min(100, numericOr(courseData.percentBoost, baseCourse.percentBoost ?? 0)),
        ),
        gradeScale:
          courseData.gradeScale && courseData.gradeScale.length > 0
            ? courseData.gradeScale
            : baseCourse.gradeScale,
        gradeScaleSnapshot:
          courseData.gradeScaleSnapshot && courseData.gradeScaleSnapshot.length > 0
            ? courseData.gradeScaleSnapshot
            : baseCourse.gradeScaleSnapshot,
        criteria: normalizedCriteria.length > 0 ? normalizedCriteria : baseCourse.criteria,
      };

      const syncedCourse = await storage.updateCourse(semesterId, updatedCourse);
      return syncedCourse;
    },
    [],
  );

  // ── Semester CRUD ─────────────────────────────────────────────────────────

  const addSemester = useCallback(async () => {
    if (serverOffline) return;
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
  }, [semesters.length, router, serverOffline]);

  const deleteSemester = useCallback(
    async (semesterId: string) => {
      if (serverOffline) return;
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
    [activeSemesterId, router, serverOffline],
  );

  const editSemester = useCallback(async (semesterId: string, newName: string) => {
    if (serverOffline) return;
    try {
      await storage.updateSemester(semesterId, { name: newName });
      setSemesters((prev) => prev.map((s) => (s.id === semesterId ? { ...s, name: newName } : s)));
      setServerOffline(false);
    } catch (error) {
      if (error instanceof ApiUnavailableError) setServerOffline(true);
      else console.error("[v0] Failed to update semester:", error);
    }
  }, [serverOffline]);

  const clearAllData = useCallback(async () => {
    if (serverOffline) return;
    let failedDeletes = 0;
    for (const s of semesters) {
      try {
        await storage.deleteSemester(s.id);
      } catch {
        failedDeletes += 1;
      }
    }
    if (failedDeletes > 0) {
      await loadSemesters();
      throw new Error(
        failedDeletes === 1
          ? "One semester could not be deleted. Please try again."
          : `${failedDeletes} semesters could not be deleted. Please try again.`,
      );
    }
    setSemesters([]);
    setActiveSemesterId(null);
  }, [loadSemesters, semesters, serverOffline]);

  // ── Course CRUD ───────────────────────────────────────────────────────────

  // Returns the created course so layout.tsx can scroll to it
  const addCourse = useCallback(async (): Promise<Course | null> => {
    if (!activeSemesterId || serverOffline) return null;
    try {
      const headerColor = getRandomHeaderColor();
      const newCourse = await storage.createCourse(
        activeSemesterId,
        `Course ${courses.length + 1}`,
        appSettings.defaultCredits,
        headerColor,
      );
      Object.assign(newCourse, buildDefaultCourseGrading(appSettings));
      newCourse.headerColor = headerColor;
      newCourse.collapsed = true;
      const syncedCourse = await storage.updateCourse(activeSemesterId, newCourse);
      syncedCourse.collapsed = true;
      setSemesters((prev) =>
        prev.map((s) =>
          s.id === activeSemesterId ? { ...s, courses: [...s.courses, syncedCourse] } : s,
        ),
      );
      setServerOffline(false);
      return syncedCourse;
    } catch (error) {
      if (error instanceof ApiUnavailableError) setServerOffline(true);
      else console.error("[v0] Failed to create course:", error);
      return null;
    }
  }, [
    activeSemesterId,
    courses.length,
    appSettings.defaultCredits,
    appSettings.defaultFailColor,
    appSettings.defaultFailLabel,
    appSettings.defaultGradeScale,
    appSettings.defaultIsPassFail,
    appSettings.defaultPassColor,
    appSettings.defaultPassLabel,
    appSettings.defaultPassThreshold,
    serverOffline,
  ]);

  const updateCourse = useCallback(
    async (id: string, updatedCourse: Course) => {
      if (!activeSemesterId || serverOffline) return;
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

      if (!isServerResourceId(id) || !isServerResourceId(activeSemesterId)) {
        console.warn("[v0] Skipping course sync until course and semester have server IDs.");
        return;
      }

      const saveVersion = (courseSaveVersionsRef.current.get(id) ?? 0) + 1;
      courseSaveVersionsRef.current.set(id, saveVersion);
      setSaveStatus("saving");
      const previousSave = courseSaveQueuesRef.current.get(id) ??
        Promise.resolve();
      const saveRequest = previousSave
        .catch(() => undefined)
        .then(async () => {
          const knownCriterionIds = syncedCriterionIdsRef.current.get(id);
          const courseToSave: Course = knownCriterionIds
            ? {
                ...sanitizedCourse,
                criteria: sanitizedCourse.criteria.map((criterion) => {
                  const clientId = criterion.clientId ?? criterion.id;
                  const serverId = knownCriterionIds.get(clientId);
                  return serverId
                    ? { ...criterion, id: serverId, clientId }
                    : criterion;
                }),
              }
            : sanitizedCourse;

          try {
            const syncedCourse = await storage.updateCourse(
              activeSemesterId,
              courseToSave,
            );
            syncedCriterionIdsRef.current.set(
              id,
              new Map(
                syncedCourse.criteria.map((criterion) => [
                  criterion.clientId ?? criterion.id,
                  criterion.id,
                ]),
              ),
            );

            if (courseSaveVersionsRef.current.get(id) !== saveVersion) return;
            setSemesters((prev) =>
              prev.map((s) =>
                s.id === activeSemesterId
                  ? {
                      ...s,
                      courses: s.courses.map((c) =>
                        c.id === id
                          ? { ...c, criteria: syncedCourse.criteria }
                          : c,
                      ),
                    }
                  : s,
              ),
            );
            setServerOffline(false);
            setSaveStatus("saved");
            if (saveStatusTimerRef.current) {
              clearTimeout(saveStatusTimerRef.current);
            }
            saveStatusTimerRef.current = setTimeout(
              () => setSaveStatus("idle"),
              SAVE_SUCCESS_DURATION_MS,
            );
          } catch (error) {
            if (courseSaveVersionsRef.current.get(id) !== saveVersion) return;
            setSaveStatus("error");
            if (saveStatusTimerRef.current) {
              clearTimeout(saveStatusTimerRef.current);
            }
            saveStatusTimerRef.current = setTimeout(
              () => setSaveStatus("idle"),
              SAVE_ERROR_DURATION_MS,
            );
            if (error instanceof ApiUnavailableError) setServerOffline(true);
            else console.error("[v0] Failed to update course:", error);
          }
        });

      courseSaveQueuesRef.current.set(id, saveRequest);
      await saveRequest;
      if (courseSaveQueuesRef.current.get(id) === saveRequest) {
        courseSaveQueuesRef.current.delete(id);
      }
    },
    [activeSemesterId, serverOffline],
  );

  const deleteCourse = useCallback(
    async (id: string) => {
      if (!activeSemesterId || serverOffline) return;
      try {
        if (isServerResourceId(activeSemesterId) && isServerResourceId(id)) {
          await storage.deleteCourse(activeSemesterId, id);
        }
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
    [activeSemesterId, serverOffline],
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
    if (orderedIds.length === 0 || serverOffline) return;
    const previousOrder = orderedSemesters.map((semester) => semester.id);
    setSemesterOrder(orderedIds);
    setSemesters((previous) => {
      const map = new Map(previous.map((s) => [s.id, s]));
      const reordered = orderedIds.map((id) => map.get(id)).filter((s): s is Semester => Boolean(s));
      if (reordered.length === previous.length) return reordered;
      return [...reordered, ...previous.filter((s) => !orderedIds.includes(s.id))];
    });
    void storage.reorderSemesters(orderedIds).catch((error) => {
      setSemesterOrder(previousOrder);
      setSemesters((previous) => {
        const map = new Map(previous.map((semester) => [semester.id, semester]));
        return previousOrder.map((id) => map.get(id)).filter((semester): semester is Semester => Boolean(semester));
      });
      if (error instanceof ApiUnavailableError) setServerOffline(true);
      else console.error("[v0] Failed to reorder semesters:", error);
    });
  }, [orderedSemesters, serverOffline]);

  const handleReorderCourses = useCallback((semesterId: string, orderedCourseIds: string[]) => {
    if (!semesterId || orderedCourseIds.length === 0 || serverOffline) return;
    const previousOrder = semesters.find((semester) => semester.id === semesterId)?.courses.map((course) => course.id) ?? [];
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
    void storage.reorderCourses(semesterId, orderedCourseIds).catch((error) => {
      setSemesters((previous) =>
        previous.map((semester) => {
          if (semester.id !== semesterId) return semester;
          const map = new Map(semester.courses.map((course) => [course.id, course]));
          return {
            ...semester,
            courses: previousOrder.map((id) => map.get(id)).filter((course): course is Course => Boolean(course)),
          };
        }),
      );
      if (error instanceof ApiUnavailableError) setServerOffline(true);
      else console.error("[v0] Failed to reorder courses:", error);
    });
  }, [semesters, serverOffline]);

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

  const exportAllDataCsv = useCallback(() => {
    const date = new Date().toISOString().slice(0, 10);
    triggerFileDownload(
      `coursegrade-all-data-${date}.csv`,
      serializeAllGradesCsv(orderedSemesters),
    );
  }, [orderedSemesters]);

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
    dashboardMessage,
    saveDashboardMessage,
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
    exportAllDataCsv,
  };
}
