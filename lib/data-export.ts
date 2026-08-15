import {
  calculateCourseGrade,
  getCriterionScore,
  getLetterGrade,
} from "./grade-utils"
import type { Course, Semester } from "./types"

const CSV_HEADERS = [
  "Semester",
  "Course",
  "Criterion",
  "Weight (%)",
  "Criterion Grade (%)",
  "Course Grade (%)",
  "Course Grade",
] as const

const escapeCsvValue = (value: string | number): string => {
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const formatNumber = (value: number): string =>
  Number.isFinite(value) ? String(Number(value.toFixed(2))) : ""

const getCourseGradeLabel = (course: Course, numericGrade: number): string => {
  if (course.isPassFail) {
    return numericGrade >= (course.passThreshold ?? 60)
      ? course.passLabel?.trim() || "P"
      : course.failLabel?.trim() || "F"
  }

  return getLetterGrade(numericGrade, course.gradeScale)
}

const serializeRow = (values: Array<string | number>): string =>
  values.map(escapeCsvValue).join(",")

export function serializeAllGradesCsv(semesters: Semester[]): string {
  const lines = [serializeRow([...CSV_HEADERS])]

  semesters.forEach((semester, semesterIndex) => {
    if (semesterIndex > 0) lines.push("")

    const courses = Array.isArray(semester.courses) ? semester.courses : []
    if (courses.length === 0) {
      lines.push(serializeRow([semester.name, "", "", "", "", "", ""]))
      return
    }

    courses.forEach((course) => {
      const criteria = Array.isArray(course.criteria) ? course.criteria : []
      const numericGrade = calculateCourseGrade(criteria, course.percentBoost)
      const gradeLabel = getCourseGradeLabel(course, numericGrade)

      if (criteria.length === 0) {
        lines.push(
          serializeRow([
            semester.name,
            course.name,
            "",
            "",
            "",
            formatNumber(numericGrade),
            gradeLabel,
          ]),
        )
        return
      }

      criteria.forEach((criterion) => {
        lines.push(
          serializeRow([
            semester.name,
            course.name,
            criterion.name,
            formatNumber(criterion.weight),
            formatNumber(getCriterionScore(criterion)),
            formatNumber(numericGrade),
            gradeLabel,
          ]),
        )
      })
    })
  })

  return `${lines.join("\r\n")}\r\n`
}
