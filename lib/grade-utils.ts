import type { Course, Criterion, GradeScale } from "./types"

const defGradeScale = [
      { letter: "A+", min: 96 },
      { letter: "A", min: 93 },
      { letter: "A-", min: 90 },
      { letter: "B+", min: 87 },
      { letter: "B", min: 83 },
      { letter: "B-", min: 80 },
      { letter: "C+", min: 77 },
      { letter: "C", min: 73 },
      { letter: "C-", min: 70 },
      { letter: "D+", min: 67 },
      { letter: "D", min: 63 },
      { letter: "D-", min: 60 },
      { letter: "F", min: 0 },
]

// Helper function to calculate criterion score from sub-items if they exist
function getCriterionScore(criterion: Criterion): number {
  if (criterion.subItems && criterion.subItems.length > 0) {
    const total = criterion.subItems.reduce((sum, item) => sum + item.score, 0)
    return total / criterion.subItems.length
  }
  return criterion.score
}

export function calculateCourseGrade(criteria: Criterion[]): number {
  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0)

  if (totalWeight === 0) return 0

  const weightedSum = criteria.reduce((sum, c) => sum + (getCriterionScore(c) * c.weight) / 100, 0)

  return weightedSum
}

export function getLetterGrade(numericGrade: number, gradeScale: GradeScale[]): string {
  // Sort by minimum score descending
  const sorted = [...gradeScale || defGradeScale].sort((a, b) => b.min - a.min)

  for (const grade of sorted) {
    if (numericGrade >= grade.min) {
      return grade.letter
    }
  }

  return sorted[sorted.length - 1]?.letter
}

export function letterGradeToGPA(letter: string): number {
  const normalized = letter?.trim().toUpperCase()
  const gpaMap: Record<string, number> = {
    "A+": 4.0,
    A: 4.0,
    "A-": 3.7,
    "B+": 3.3,
    B: 3.0,
    "B-": 2.7,
    "C+": 2.3,
    C: 2.0,
    "C-": 1.7,
    "D+": 1.3,
    D: 1.0,
    "D-": 0.7,
    F: 0.0,
  }

  if (!normalized) return -1.0
  return gpaMap[normalized] ?? -1.0
}

export function calculateGPA(courses: Course[]): number {
  if (courses.length === 0) return 0

  let totalPoints = 0
  let totalCredits = 0

  for (const course of courses) {
    const numericGrade = calculateCourseGrade(course.criteria)
    const letterGrade = getLetterGrade(numericGrade, course.gradeScale)
    const gradePoints = letterGradeToGPA(letterGrade)

    if (gradePoints != -1.0) {
          totalPoints += gradePoints * course.credits
    totalCredits += course.credits
    }
  }

  return totalCredits > 0 ? totalPoints / totalCredits : 0
}

export function getLetterGradeColor(letter: string): string {
  const colorMap: Record<string, string> = {
    "A+": "#10b981", // emerald-500
    A: "#22c55e", // green-500
    "A-": "#84cc16", // lime-500
    "B+": "#a3e635", // lime-400
    B: "#eab308", // yellow-500
    "B-": "#f59e0b", // amber-500
    "C+": "#f97316", // orange-500
    C: "#fb923c", // orange-400
    "C-": "#fdba74", // orange-300
    "D+": "#f87171", // red-400
    D: "#ef4444", // red-500
    "D-": "#dc2626", // red-600
    F: "#b91c1c", // red-700
  }
  return colorMap[letter] || "#6b7280" // gray-500 as fallback
}

export function calculateGradeDistribution(courses: Course[]): Record<string, number> {
  const distribution: Record<string, number> = {}

  for (const course of courses) {
    const numericGrade = calculateCourseGrade(course.criteria)
    const letterGrade = getLetterGrade(numericGrade, course.gradeScale)
    distribution[letterGrade] = (distribution[letterGrade] || 0) + 1
  }

  return distribution
}

export function isCourseDefault(course: Course): boolean {
  // Check if name matches default pattern
  const isDefaultName = course.name.match(/^Course \d+$/)

  // Check if all criteria have default values (score = 0)
  const hasDefaultScores = course.criteria.every((criterion) => {
    if (criterion.subItems && criterion.subItems.length > 0) {
      return criterion.subItems.every((item) => item.score === 0)
    }
    return criterion.score === 0
  })

  return !!(isDefaultName && hasDefaultScores)
}

export function isSemesterDefault(semester: { name: string; courses: Course[] }): boolean {
  // Check if name matches default pattern
  const isDefaultName = semester.name.match(/^Semester \d+$/)

  // Check if semester has no courses
  const hasNoCourses = semester.courses.length === 0

  return !!(isDefaultName && hasNoCourses)
}
