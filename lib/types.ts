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
