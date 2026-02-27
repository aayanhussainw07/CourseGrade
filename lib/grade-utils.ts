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
const normalizeCriteria = (criteria?: Criterion[] | null): Criterion[] => (Array.isArray(criteria) ? criteria : [])

function getCriterionScore(criterion: Criterion): number {
  if (criterion.subItems && criterion.subItems.length > 0) {
    const scores = criterion.subItems.map(item => item.score)
    const dropLowest = criterion.dropLowest || 0

    // If we have items to drop and enough scores
    if (dropLowest > 0 && scores.length > dropLowest) {
      // Sort scores in ascending order
      const sortedScores = [...scores].sort((a, b) => a - b)
      // Remove the lowest N scores
      const keptScores = sortedScores.slice(dropLowest)
      // Calculate average of remaining scores
      const total = keptScores.reduce((sum, score) => sum + score, 0)
      return total / keptScores.length
    }

    // Default behavior: average all scores
    const total = scores.reduce((sum, score) => sum + score, 0)
    return total / scores.length
  }
  return criterion.score
}

export function calculateCourseGrade(
  rawCriteria: Criterion[] | null | undefined,
  percentBoost?: number | null,
): number {
  const criteria = normalizeCriteria(rawCriteria)
  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0)
  const boost = Math.max(0, percentBoost ?? 0)
  if (totalWeight === 0) return Number.parseFloat(boost.toFixed(2))

  const result = criteria.reduce((sum, criterion) => {
    const baseScore = getCriterionScore(criterion)
    const extra = Math.max(0, criterion.extraCredit ?? 0)
    const effectiveScore = baseScore + extra
    return sum + (effectiveScore * criterion.weight) / 100
  }, 0)

  const finalScore = result + boost

  return Number.parseFloat(finalScore.toFixed(2))
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
    "A+": 4.3,
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

export function calculateGPA(courses: Course[] | null | undefined): number {
  const safeCourses = Array.isArray(courses) ? courses : []
  if (safeCourses.length === 0) return 0

  let totalPoints = 0
  let totalCredits = 0

  for (const course of safeCourses) {
    // Skip pass/fail courses - they don't count toward GPA
    if (course.isPassFail) continue

    const numericGrade = calculateCourseGrade(course.criteria, course.percentBoost)
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
    "A+": "#ffffff",
    A: "#f1f1f1",
    "A-": "#e3e3e3",
    "B+": "#d5d5d5",
    B: "#c6c6c6",
    "B-": "#b7b7b7",
    "C+": "#a6a6a6",
    C: "#959595",
    "C-": "#848484",
    "D+": "#727272",
    D: "#626262",
    "D-": "#515151",
    F: "#404040",
  }
  return colorMap[letter] || "#7a7a7a"
}

const parseColorChannels = (value: string): [number, number, number] | null => {
  const trimmed = value.trim()

  const hexMatch = trimmed.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hexMatch) {
    const hex = hexMatch[1]
    if (hex.length === 3) {
      const r = Number.parseInt(hex[0] + hex[0], 16)
      const g = Number.parseInt(hex[1] + hex[1], 16)
      const b = Number.parseInt(hex[2] + hex[2], 16)
      return [r, g, b]
    }
    const r = Number.parseInt(hex.slice(0, 2), 16)
    const g = Number.parseInt(hex.slice(2, 4), 16)
    const b = Number.parseInt(hex.slice(4, 6), 16)
    return [r, g, b]
  }

  const rgbMatch = trimmed.match(
    /^rgba?\(\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)(?:\s*,\s*[+-]?\d*\.?\d+\s*)?\)$/i,
  )
  if (!rgbMatch) return null

  const r = Number.parseFloat(rgbMatch[1])
  const g = Number.parseFloat(rgbMatch[2])
  const b = Number.parseFloat(rgbMatch[3])
  if ([r, g, b].some((channel) => Number.isNaN(channel))) return null

  return [r, g, b]
}

export function getMonochromeCardColor(value?: string | null): string | null {
  if (!value) return null
  const channels = parseColorChannels(value)
  if (!channels) return null
  const [r, g, b] = channels.map((channel) => Math.round(channel))
  return r === g && g === b ? value : null
}

export function calculateGradeDistribution(courses: Course[]): Record<string, number> {
  const distribution: Record<string, number> = {}

  for (const course of courses) {
    const numericGrade = calculateCourseGrade(course.criteria, course.percentBoost)
    const letterGrade = getLetterGrade(numericGrade, course.gradeScale)
    distribution[letterGrade] = (distribution[letterGrade] || 0) + 1
  }

  return distribution
}

export function isCourseDefault(course: Course): boolean {
  // Check if name matches default pattern
  const isDefaultName = course.name.match(/^Course \d+$/)

  // Check if all criteria have default values (score = 0)
  const criteria = normalizeCriteria(course.criteria)
  const hasDefaultScores = criteria.every((criterion) => {
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
