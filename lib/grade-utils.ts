import type { Course, Criterion, GradeScale } from "./types"
import { DEFAULT_GRADE_SCALE } from "./types"

export const cloneGradeScale = (scale: GradeScale[]): GradeScale[] => scale.map((grade) => ({ ...grade }))

const HEX_COLOR = /^#[0-9a-f]{6}$/i

export function normalizeGradeScaleMetadata(
  scale: GradeScale[],
  legacyAPlusValue = 4.33,
  fallbackScale: GradeScale[] = DEFAULT_GRADE_SCALE,
): GradeScale[] {
  return scale.map((grade) => {
    const { gpa: _storedGpa, color: _storedColor, ...baseGrade } = grade
    const fallback = fallbackScale.find(
      (candidate) => candidate.letter === grade.letter.trim().toUpperCase(),
    )
    const standard = DEFAULT_GRADE_SCALE.find(
      (candidate) => candidate.letter === grade.letter.trim().toUpperCase(),
    )
    const gpa =
      typeof grade.gpa === "number" && Number.isFinite(grade.gpa) && grade.gpa >= 0
        ? grade.gpa
        : grade.letter.trim().toUpperCase() === "A+" && legacyAPlusValue !== 4.33
          ? legacyAPlusValue
          : fallback?.gpa ?? standard?.gpa
    const color =
      typeof grade.color === "string" && HEX_COLOR.test(grade.color)
        ? grade.color.toLowerCase()
        : fallback?.color ?? standard?.color
    return { ...baseGrade, ...(gpa === undefined ? {} : { gpa }), ...(color ? { color } : {}) }
  })
}

export function buildPassFailScale(settings: {
  passLabel?: string
  failLabel?: string
  threshold?: number
  passColor?: string
  failColor?: string
}): GradeScale[] {
  const passLabel = settings.passLabel?.trim() || "P"
  const failLabel = settings.failLabel?.trim() || "F"
  const rawThreshold = typeof settings.threshold === "number" ? settings.threshold : 60
  const threshold = Math.min(100, Math.max(0, rawThreshold))

  return [
    { letter: passLabel, min: threshold, color: settings.passColor || "#888888" },
    { letter: failLabel, min: 0, color: settings.failColor || "#8a8a8a" },
  ]
}

export function buildDefaultCourseGrading(settings: {
  defaultGradeScale: GradeScale[]
  defaultIsPassFail: boolean
  defaultPassLabel: string
  defaultFailLabel: string
  defaultPassThreshold: number
  defaultPassColor?: string
  defaultFailColor?: string
}): Pick<
  Course,
  | "gradeScale"
  | "gradeScaleSnapshot"
  | "isPassFail"
  | "passLabel"
  | "failLabel"
  | "passThreshold"
  | "passColor"
  | "failColor"
> {
  const letterScale = cloneGradeScale(settings.defaultGradeScale)
  const passFailSettings = {
    passLabel: settings.defaultPassLabel,
    failLabel: settings.defaultFailLabel,
    threshold: settings.defaultPassThreshold,
    passColor: settings.defaultPassColor,
    failColor: settings.defaultFailColor,
  }

  return {
    isPassFail: settings.defaultIsPassFail,
    passLabel: passFailSettings.passLabel,
    failLabel: passFailSettings.failLabel,
    passThreshold: passFailSettings.threshold,
    passColor: passFailSettings.passColor,
    failColor: passFailSettings.failColor,
    gradeScale: settings.defaultIsPassFail
      ? buildPassFailScale(passFailSettings)
      : letterScale,
    gradeScaleSnapshot: settings.defaultIsPassFail ? letterScale : undefined,
  }
}

// Helper function to calculate criterion score from sub-items if they exist
const normalizeCriteria = (criteria?: Criterion[] | null): Criterion[] => (Array.isArray(criteria) ? criteria : [])

export function buildCriterionAdditionUpdate(
  rawCriteria: Criterion[] | null | undefined,
  newCriterion: Criterion,
  currentPercentBoost?: number | null,
): Pick<Course, "criteria" | "percentBoost"> {
  const criteria = normalizeCriteria(rawCriteria)
  return {
    criteria: [...criteria, newCriterion],
    percentBoost: criteria.length === 0 ? 0 : (currentPercentBoost ?? 0),
  }
}

export function getCriterionScore(criterion: Criterion): number {
  if (criterion.subItems && criterion.subItems.length > 0) {
    const items = criterion.subItems
    const hasWeights = items.some((item) => item.weight !== undefined && item.weight > 0)
    const dropLowest = criterion.dropLowest || 0
    let effectiveItems = items
    if (dropLowest > 0 && items.length > dropLowest) {
      effectiveItems = [...items].sort((a, b) => a.score - b.score).slice(dropLowest)
    }
    if (hasWeights) {
      return effectiveItems.reduce((sum, item) => sum + item.score * (item.weight ?? 0) / 100, 0)
    }
    const total = effectiveItems.reduce((sum, item) => sum + item.score, 0)
    return total / effectiveItems.length
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
  return getGradeScaleEntry(numericGrade, gradeScale)?.letter ?? ""
}

export function getGradeScaleEntry(
  numericGrade: number,
  gradeScale: GradeScale[],
): GradeScale | undefined {
  // Sort by minimum score descending
  const sorted = [...gradeScale || DEFAULT_GRADE_SCALE].sort((a, b) => b.min - a.min)

  for (const grade of sorted) {
    if (numericGrade >= grade.min) {
      return grade
    }
  }

  return sorted[sorted.length - 1]
}

export function letterGradeToGPA(letter: string, aPlusValue = 4.33): number {
  const normalized = letter?.trim().toUpperCase()
  if (!normalized) return -1.0
  if (normalized === "A+") return aPlusValue
  return DEFAULT_GRADE_SCALE.find((grade) => grade.letter === normalized)?.gpa ?? -1.0
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
    const resolvedGrade = getGradeScaleEntry(numericGrade, course.gradeScale)
    const gradePoints = resolvedGrade?.gpa

    if (typeof gradePoints === "number" && Number.isFinite(gradePoints) && gradePoints >= 0) {
      totalPoints += gradePoints * course.credits
      totalCredits += course.credits
    }
  }

  return totalCredits > 0 ? totalPoints / totalCredits : 0
}

export interface GradeDistributionEntry {
  letter: string
  count: number
  color: string
  gpa: number
  pct: number
}

export function buildGradeDistribution(courses: Course[]): GradeDistributionEntry[] {
  const grouped = new Map<string, Omit<GradeDistributionEntry, "pct">>()
  for (const course of courses) {
    if (course.isPassFail) continue
    const numeric = calculateCourseGrade(course.criteria, course.percentBoost)
    const grade = getGradeScaleEntry(numeric, course.gradeScale)
    if (!grade) continue
    const existing = grouped.get(grade.letter)
    if (existing) {
      existing.count += 1
    } else {
      grouped.set(grade.letter, {
        letter: grade.letter,
        count: 1,
        color: grade.color || getLetterGradeColor(grade.letter, course.gradeScale),
        gpa: typeof grade.gpa === "number" && Number.isFinite(grade.gpa) ? grade.gpa : -1,
      })
    }
  }
  const entries = [...grouped.values()]
  const total = entries.reduce((sum, entry) => sum + entry.count, 0)
  return entries
    .sort((a, b) => b.gpa - a.gpa || a.letter.localeCompare(b.letter))
    .map((entry) => ({ ...entry, pct: total ? Math.round((entry.count / total) * 100) : 0 }))
}

export function getLetterGradeColor(letter: string, gradeScale?: GradeScale[]): string {
  const custom = gradeScale?.find((grade) => grade.letter === letter)?.color
  if (custom) return custom
  return DEFAULT_GRADE_SCALE.find((grade) => grade.letter === letter)?.color || "#888888"
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
