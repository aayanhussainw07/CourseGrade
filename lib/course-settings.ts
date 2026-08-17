import type { Course, SubItem } from "./types"

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
  | "passColor"
  | "failColor"
  | "headerColor"
  | "percentBoost"
> & {
  criterionExtras?: Record<string, StoredCriterionExtras>
}

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
