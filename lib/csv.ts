import type { Course, GradeScale, Semester, SubItem } from "./types"

interface CoursePortableData {
  name: string
  credits: number
  isPassFail: boolean
  passLabel: string
  failLabel: string
  passThreshold: number
  headerColor?: string | null
  percentBoost?: number
  gradeScale: GradeScale[]
  criteria: Array<{
    name: string
    weight: number
    score: number
    extraCredit: number
    dropLowest: number
    subItems: SubItem[]
  }>
}

interface SemesterPortableData {
  name: string
  background?: string
  courses: CoursePortableData[]
}

const sanitizeCriteria = (course: Course) => {
  const criteria = Array.isArray(course.criteria) ? course.criteria : []
  return criteria.map((criterion) => ({
    name: criterion.name,
    weight: criterion.weight,
    score: criterion.score,
    extraCredit: criterion.extraCredit ?? 0,
    dropLowest: criterion.dropLowest ?? 0,
    subItems: (criterion.subItems || []).map((subItem) => ({
      name: subItem.name,
      score: subItem.score,
      id: subItem.id,
    })),
  }))
}

const createPortableEnvelope = (type: "course" | "semester", data: unknown) =>
  JSON.stringify({ version: 1, type, data }, null, 2)

const parsePortableEnvelope = (raw: string) => {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error("Empty file")
  }
  try {
    return JSON.parse(trimmed)
  } catch {
    throw new Error("Invalid JSON export")
  }
}

export const serializeCourseCsv = (course: Course): string => {
  const portable: CoursePortableData = {
    name: course.name,
    credits: course.credits,
    isPassFail: course.isPassFail ?? false,
    passLabel: course.passLabel ?? "P",
    failLabel: course.failLabel ?? "F",
    passThreshold: course.passThreshold ?? 60,
    headerColor: course.headerColor ?? null,
    percentBoost: course.percentBoost ?? 0,
    gradeScale: course.gradeScale,
    criteria: sanitizeCriteria(course),
  }
  return createPortableEnvelope("course", portable)
}

export const parseCourseCsv = (content: string): CoursePortableData => {
  const parsed = parsePortableEnvelope(content)
  if (parsed?.type !== "course" || !parsed?.data) {
    throw new Error("Not a course export")
  }
  return parsed.data as CoursePortableData
}

export const serializeSemesterCsv = (semester: Semester): string => {
  const portable: SemesterPortableData = {
    name: semester.name,
    background: semester.background,
    courses: semester.courses.map((course) => ({
      name: course.name,
      credits: course.credits,
      isPassFail: course.isPassFail ?? false,
      passLabel: course.passLabel ?? "P",
      failLabel: course.failLabel ?? "F",
      passThreshold: course.passThreshold ?? 60,
      headerColor: course.headerColor ?? null,
      percentBoost: course.percentBoost ?? 0,
      gradeScale: course.gradeScale,
      criteria: sanitizeCriteria(course),
    })),
  }
  return createPortableEnvelope("semester", portable)
}

export const parseSemesterCsv = (content: string): SemesterPortableData => {
  const parsed = parsePortableEnvelope(content)
  if (parsed?.type !== "semester" || !parsed?.data) {
    throw new Error("Not a semester export")
  }
  return parsed.data as SemesterPortableData
}

export type { CoursePortableData, SemesterPortableData }
