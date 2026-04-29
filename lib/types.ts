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
}

export const DEFAULT_GRADE_SCALE: GradeScale[] = [
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
  headerColor?: string | null
}

export interface Semester {
  id: string
  name: string
  courses: Course[]
  background?: string
  timelineDate?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface ApiSemester {
  id: number
  name: string
  background?: string
  timeline_date?: string | null
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
  created_at: string
  updated_at: string
}

export interface ApiGradeScale {
  id: number
  letter: string
  min_percentage: number
  gpa_value: number
  created_at: string
}

export function apiToFrontendSemester(apiSemester: ApiSemester): Semester {
  return {
    id: apiSemester.id.toString(),
    name: apiSemester.name,
    courses: apiSemester.courses.map(apiToFrontendCourse),
    background: apiSemester.background,
    timelineDate: apiSemester.timeline_date ?? null,
    createdAt: apiSemester.created_at,
    updatedAt: apiSemester.updated_at,
  }
}

const normalizePercentage = (value: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) return 0
  return Number.parseFloat(value.toFixed(2))
}

export function apiToFrontendCourse(apiCourse: ApiCourse): Course {
  return {
    id: apiCourse.id.toString(),
    name: apiCourse.name,
    credits: apiCourse.credits,
    percentBoost: normalizePercentage(apiCourse.percent_boost ?? 0),
    criteria: apiCourse.assignments.map((assignment) => ({
      id: assignment.id.toString(),
      clientId: assignment.id.toString(),
      name: assignment.name,
      weight: assignment.weight,
      score: assignment.total > 0 ? normalizePercentage((assignment.earned / assignment.total) * 100) : 0,
      dropLowest: assignment.drop_lowest ?? 0,
      extraCredit: 0,
    })),
    gradeScale: DEFAULT_GRADE_SCALE.map((grade) => ({ ...grade })),
    collapsed: false,
    isPassFail: apiCourse.is_pass_fail ?? false,
    passLabel: "P",
    failLabel: "F",
    passThreshold: 60,
    headerColor: apiCourse.header_color ?? null,
  }
}
