import { type Course, type Semester } from "@/lib/types";
import type { CoursePortableData } from "@/lib/csv";
import { getLetterGradeColor } from "@/lib/grade-utils";

export const SEMESTER_ORDER_STORAGE_KEY = "grade-calculator-semester-order";
export const ACTIVE_SEMESTER_STORAGE_KEY = "grade-calculator-active-semester";
export const COURSE_SETTINGS_STORAGE_KEY = "grade-calculator-course-settings";
export const DASHBOARD_SENTINEL = "__dashboard__";
export const DASHBOARD_MESSAGE_STORAGE_PREFIX =
  "grade-calculator-dashboard-message";

export type Snapshot = {
  semesters: Semester[];
  semesterOrder: string[];
  activeSemesterId: string | null;
};

export interface DashboardBackupPayload {
  version: number;
  generatedAt: string;
  semesterOrder: string[];
  semesters: Array<{
    id?: string;
    name: string;
    background?: string;
    timelineDate?: string | null;
    courses: CoursePortableData[];
  }>;
}

export const generateClientId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export const deepCopy = <T,>(value: T): T => {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
};

export const sanitizeSemesters = (semesters: Semester[], current?: Semester[]) => {
  const collapseMap = new Map(
    (current || []).flatMap((semester) =>
      (semester.courses || []).map((course) => [course.id, course.collapsed]),
    ),
  );

  return semesters.map((semester) => ({
    ...semester,
    courses: (semester.courses || []).map((course) => {
      const { collapsed, ...rest } = course;
      return { ...rest, collapsed: collapseMap.get(course.id) ?? false };
    }),
  }));
};

export const triggerFileDownload = (filename: string, content: string) => {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const safeFilename = (name: string | undefined, fallback: string) => {
  if (name && name.length > 0) {
    const sanitized = name.replace(/[^a-z0-9]+/gi, "_");
    return sanitized.length > 0 ? sanitized : fallback;
  }
  return fallback;
};

export const courseToPortable = (course: Course): CoursePortableData => ({
  name: course.name,
  credits: course.credits,
  percentBoost: course.percentBoost ?? 0,
  isPassFail: course.isPassFail ?? false,
  passLabel: course.passLabel ?? "P",
  failLabel: course.failLabel ?? "F",
  passThreshold: course.passThreshold ?? 60,
  passColor: course.passColor ?? "#888888",
  failColor: course.failColor ?? "#8a8a8a",
  headerColor: course.headerColor ?? null,
  gradeScale:
    Array.isArray(course.gradeScale) && course.gradeScale.length > 0
      ? course.gradeScale
      : [],
  gradeScaleSnapshot: course.gradeScaleSnapshot,
  criteria: (Array.isArray(course.criteria) ? course.criteria : []).map(
    (criterion) => ({
      name: criterion.name,
      weight: criterion.weight,
      score: criterion.score,
      extraCredit: criterion.extraCredit ?? 0,
      dropLowest: criterion.dropLowest ?? 0,
      subItems: (Array.isArray(criterion.subItems)
        ? criterion.subItems
        : []
      ).map((subItem) => ({
        id: subItem.id,
        name: subItem.name,
        score: subItem.score,
      })),
    }),
  ),
});

export const readStoredSemesterOrder = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SEMESTER_ORDER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
};

export const writeStoredSemesterOrder = (order: string[]) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SEMESTER_ORDER_STORAGE_KEY, JSON.stringify(order));
  } catch {
    // Ignore storage errors
  }
};

const normalizeStorageScope = (scopeId: string | null | undefined) => {
  if (typeof scopeId !== "string") return "default";
  const sanitized = scopeId.trim();
  return sanitized.length > 0 ? sanitized : "default";
};

const dashboardMessageStorageKey = (scopeId: string | null | undefined) =>
  `${DASHBOARD_MESSAGE_STORAGE_PREFIX}:${normalizeStorageScope(scopeId)}`;

export const readStoredDashboardMessage = (
  scopeId: string | null | undefined,
) => {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(dashboardMessageStorageKey(scopeId)) ?? "";
  } catch {
    return "";
  }
};

export const writeStoredDashboardMessage = (
  scopeId: string | null | undefined,
  value: string,
) => {
  if (typeof window === "undefined") return;
  try {
    const key = dashboardMessageStorageKey(scopeId);
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, trimmed);
  } catch {
    // Ignore storage errors
  }
};

export const formatDateLabel = (value?: string | null) => {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
  });
};

export const gpaToLetterGrade = (gpa: number, aPlusValue = 4.33): string => {
  const scale: [string, number][] = [
    ["A+", aPlusValue],
    ["A",  4.0],
    ["A-", 3.7],
    ["B+", 3.3],
    ["B",  3.0],
    ["B-", 2.7],
    ["C+", 2.3],
    ["C",  2.0],
    ["C-", 1.7],
    ["D+", 1.3],
    ["D",  1.0],
    ["D-", 0.7],
  ];
  for (const [letter, pts] of scale) {
    if (gpa >= pts) return letter;
  }
  return "F";
};

export const getGpaColor = (gpa: number) => getLetterGradeColor(gpaToLetterGrade(gpa));

export const parseSemesterSortValue = (semester: Semester) => {
  const source = semester.createdAt ?? semester.updatedAt;
  const parsed = source ? Date.parse(source) : Number.NaN;
  if (Number.isNaN(parsed)) {
    return Number.MAX_SAFE_INTEGER;
  }
  return parsed;
};

export const isServerResourceId = (value: string | null | undefined) =>
  typeof value === "string" && /^\d+$/.test(value);
