export interface Criterion {
  id: string
  name: string
  weight: number // percentage
  score: number // percentage (used if no sub-items)
  subItems?: SubItem[]
}

export interface SubItem {
  id: string
  name: string
  score: number // percentage
}

export interface GradeScale {
  letter: string
  min: number // minimum percentage for this grade
}

export interface Course {
  id: string
  name: string
  credits: number
  criteria: Criterion[]
  gradeScale: GradeScale[]
  collapsed?: boolean
}

export interface Semester {
  id: string
  name: string
  courses: Course[]
}

export interface ApiSemester {
  id: number
  name: string
  courses: ApiCourse[]
  created_at: string
  updated_at: string
}

export interface ApiCourse {
  id: number
  semester: number
  name: string
  credits: number
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
  }
}

export function apiToFrontendCourse(apiCourse: ApiCourse): Course {
  return {
    id: apiCourse.id.toString(),
    name: apiCourse.name,
    credits: apiCourse.credits,
    criteria: apiCourse.assignments.map((assignment) => ({
      id: assignment.id.toString(),
      name: assignment.name,
      weight: assignment.weight,
      score: assignment.total > 0 ? (assignment.earned / assignment.total) * 100 : 0,
    })),
    gradeScale: [
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
    ],
    collapsed: false,
  }
}
