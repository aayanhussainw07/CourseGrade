import type { Course, GradeScale, Semester, SubItem } from "./types"
import { cloneGradeScale } from "./grade-utils"

const COURSE_SETTINGS_KEY = "grade-calculator-course-settings"

type StoredCriterionExtras = {
  extraCredit?: number
  subItems?: SubItem[]
}

export type StoredCourseSettings = Pick<
  Course,
  | "gradeScale"
  | "gradeScaleSnapshot"
  | "isPassFail"
  | "passLabel"
  | "failLabel"
  | "passThreshold"
  | "cardColor"
  | "percentBoost"
> & {
  criterionExtras?: Record<string, StoredCriterionExtras>
}

const cloneOptionalGradeScale = (scale?: GradeScale[]) => scale ? cloneGradeScale(scale) : undefined
const cloneSubItems = (items?: SubItem[]) => items?.map((item) => ({ ...item }))

export const readStoredCourseSettings = (): Record<string, StoredCourseSettings> => {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(COURSE_SETTINGS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return {}
    return parsed
  } catch (error) {
    console.warn("[v0] Failed to read course settings:", error)
    return {}
  }
}

export const writeStoredCourseSettings = (settings: Record<string, StoredCourseSettings>) => {
  if (typeof window === "undefined") return
  localStorage.setItem(COURSE_SETTINGS_KEY, JSON.stringify(settings))
}

export const persistCourseSettings = (course: Course) => {
  if (typeof window === "undefined") return
  const settings = readStoredCourseSettings()
  const criteria = Array.isArray(course.criteria) ? course.criteria : []
  const storedCourse: StoredCourseSettings = {
    gradeScale: cloneGradeScale(course.gradeScale),
    gradeScaleSnapshot: cloneOptionalGradeScale(course.gradeScaleSnapshot),
    isPassFail: course.isPassFail ?? false,
    passLabel: course.passLabel ?? "P",
    failLabel: course.failLabel ?? "F",
    passThreshold: course.passThreshold ?? 60,
    cardColor: course.cardColor ?? null,
    percentBoost: course.percentBoost ?? 0,
  }
  const criterionExtras: Record<string, StoredCriterionExtras> = {}
  for (const criterion of criteria) {
    const key = criterion.clientId ?? criterion.id
    const extraCredit = criterion.extraCredit ?? 0
    const subItemsClone = cloneSubItems(criterion.subItems)
    const hasSubItems = !!(subItemsClone && subItemsClone.length > 0)
    const hasExtraCredit = extraCredit !== 0
    if (!hasSubItems && !hasExtraCredit) continue
    criterionExtras[key] = {
      ...(hasExtraCredit ? { extraCredit } : {}),
      ...(hasSubItems ? { subItems: subItemsClone } : {}),
    }
  }
  if (Object.keys(criterionExtras).length > 0) {
    storedCourse.criterionExtras = criterionExtras
  }
  settings[course.id] = storedCourse
  writeStoredCourseSettings(settings)
}

export const removeCourseSettings = (courseId: string) => {
  if (typeof window === "undefined") return
  const settings = readStoredCourseSettings()
  if (settings[courseId]) {
    delete settings[courseId]
    writeStoredCourseSettings(settings)
  }
}

export const applyStoredSettingsToSemesters = (semesters: Semester[]): Semester[] => {
  if (typeof window === "undefined") return semesters
  const settings = readStoredCourseSettings()
  if (Object.keys(settings).length === 0) return semesters
  return semesters.map((semester) => ({
    ...semester,
    courses: (semester.courses ?? []).map((course) => {
      const stored = settings[course.id]
      if (!stored) return course
      const extras = stored.criterionExtras ?? {}
      return {
        ...course,
        gradeScale: cloneGradeScale(stored.gradeScale),
        gradeScaleSnapshot: cloneOptionalGradeScale(stored.gradeScaleSnapshot),
        isPassFail: stored.isPassFail ?? course.isPassFail,
        passLabel: stored.passLabel ?? course.passLabel,
        failLabel: stored.failLabel ?? course.failLabel,
        passThreshold: stored.passThreshold ?? course.passThreshold,
        cardColor: stored.cardColor ?? course.cardColor ?? null,
        percentBoost: stored.percentBoost ?? course.percentBoost ?? 0,
        criteria: (course.criteria ?? []).map((criterion) => {
          const key = criterion.clientId ?? criterion.id
          const extra = extras[key]
          if (!extra) return criterion
          const next = { ...criterion }
          if (typeof extra.extraCredit === "number") {
            next.extraCredit = extra.extraCredit
          }
          if (Object.prototype.hasOwnProperty.call(extra, "subItems")) {
            next.subItems = extra.subItems?.map((item) => ({ ...item })) ?? []
          }
          return next
        }),
      }
    }),
  }))
}
