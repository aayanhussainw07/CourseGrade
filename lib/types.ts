export interface Criterion {
  id: string
  clientId?: string
  name: string
  weight: number // percentage
  score: number // percentage (used if no sub-items)
  subItems?: SubItem[]
  dropLowest?: number // number of lowest scores to drop (for sub-items)
  extraCredit?: number // additional boost applied directly to the final grade
}

export interface SubItem {
  id: string
  name: string
  score: number // percentage
  weight?: number // optional weight for weighted sub-averages
}

export interface GradeScale {
  letter: string
  min: number // minimum percentage for this grade
  gpa?: number // omitted only for legacy/custom grades that have not been configured
  color?: string // six-digit hex; omitted legacy values use the canonical fallback
}

export const DEFAULT_GRADE_SCALE: GradeScale[] = [
  { letter: "A+", min: 96, gpa: 4.33, color: "#e8756a" },
  { letter: "A", min: 93, gpa: 4, color: "#d9645a" },
  { letter: "A-", min: 90, gpa: 3.7, color: "#c5534a" },
  { letter: "B+", min: 87, gpa: 3.3, color: "#e8a068" },
  { letter: "B", min: 83, gpa: 3, color: "#d98e58" },
  { letter: "B-", min: 80, gpa: 2.7, color: "#c57e4a" },
  { letter: "C+", min: 77, gpa: 2.3, color: "#d9c058" },
  { letter: "C", min: 73, gpa: 2, color: "#c8ae48" },
  { letter: "C-", min: 70, gpa: 1.7, color: "#b59a3a" },
  { letter: "D+", min: 67, gpa: 1.3, color: "#9898d0" },
  { letter: "D", min: 63, gpa: 1, color: "#8484be" },
  { letter: "D-", min: 60, gpa: 0.7, color: "#7070ac" },
  { letter: "F", min: 0, gpa: 0, color: "#8a8a8a" },
]

export interface Course {
  id: string
  name: string
  credits: number
  percentBoost?: number
  criteria: Criterion[]
  gradeScale: GradeScale[]
  gradeScaleSnapshot?: GradeScale[]
  collapsed?: boolean
  isPassFail?: boolean // true if course is pass/fail (doesn't count toward GPA)
  passLabel?: string
  failLabel?: string
  passThreshold?: number
  passColor?: string
  failColor?: string
  headerColor?: string | null
}

export interface Semester {
  id: string
  name: string
  courses: Course[]
  background?: string
  timelineDate?: string | null
  ignored?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface ApiSemester {
  id: number
  name: string
  background?: string
  timeline_date?: string | null
  ignored?: boolean
  sort_order?: number
  courses: ApiCourse[]
  created_at: string
  updated_at: string
}

export interface ApiCourse {
  id: number
  semester: number
  name: string
  credits: number
  is_pass_fail?: boolean
  percent_boost?: number
  header_color?: string | null
  sort_order?: number
  pass_label?: string
  fail_label?: string
  pass_threshold?: number
  pass_color?: string
  fail_color?: string
  letter_grade_scale?: GradeScale[] | null
  assignments: ApiAssignment[]
  created_at: string
  updated_at: string
}

export interface ApiAssignment {
  id: number
  course: number
  name: string
  weight: number
  earned: number
  total: number
  drop_lowest?: number
  client_id?: string
  sort_order?: number
  extra_credit?: number
  sub_items?: SubItem[]
  created_at: string
  updated_at: string
}

export interface ApiGradeScale {
  id: number
  letter: string
  min_percentage: number
  gpa_value: number
  color?: string
  created_at: string
}

export function apiToFrontendSemester(apiSemester: ApiSemester): Semester {
  return {
    id: apiSemester.id.toString(),
    name: apiSemester.name,
    courses: apiSemester.courses.map(apiToFrontendCourse),
    background: apiSemester.background,
    timelineDate: apiSemester.timeline_date ?? null,
    ignored: apiSemester.ignored ?? false,
    createdAt: apiSemester.created_at,
    updatedAt: apiSemester.updated_at,
  }
}

const normalizePercentage = (value: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) return 0
  return Number.parseFloat(value.toFixed(2))
}

export function apiToFrontendCourse(apiCourse: ApiCourse): Course {
  const letterGradeScale =
    Array.isArray(apiCourse.letter_grade_scale) && apiCourse.letter_grade_scale.length > 0
      ? apiCourse.letter_grade_scale.map((grade) => ({ ...grade }))
      : DEFAULT_GRADE_SCALE.map((grade) => ({ ...grade }))
  const isPassFail = apiCourse.is_pass_fail ?? false
  const passLabel = apiCourse.pass_label || "P"
  const failLabel = apiCourse.fail_label || "F"
  const passThreshold = normalizePercentage(apiCourse.pass_threshold ?? 60)
  const passColor = apiCourse.pass_color || "#888888"
  const failColor = apiCourse.fail_color || "#8a8a8a"
  return {
    id: apiCourse.id.toString(),
    name: apiCourse.name,
    credits: apiCourse.credits,
    percentBoost: normalizePercentage(apiCourse.percent_boost ?? 0),
    criteria: apiCourse.assignments.map((assignment) => ({
      id: assignment.id.toString(),
      clientId: assignment.client_id || assignment.id.toString(),
      name: assignment.name,
      weight: assignment.weight,
      score: assignment.total > 0 ? normalizePercentage((assignment.earned / assignment.total) * 100) : 0,
      dropLowest: assignment.drop_lowest ?? 0,
      extraCredit: normalizePercentage(assignment.extra_credit ?? 0),
      subItems: Array.isArray(assignment.sub_items)
        ? assignment.sub_items.map((item) => ({ ...item }))
        : [],
    })),
    gradeScale: isPassFail
      ? [
          { letter: passLabel, min: passThreshold, color: passColor },
          { letter: failLabel, min: 0, color: failColor },
        ]
      : letterGradeScale,
    gradeScaleSnapshot: isPassFail ? letterGradeScale : undefined,
    collapsed: false,
    isPassFail,
    passLabel,
    failLabel,
    passThreshold,
    passColor,
    failColor,
    headerColor: apiCourse.header_color ?? null,
  }
}
