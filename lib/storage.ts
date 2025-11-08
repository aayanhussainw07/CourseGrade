// Hybrid storage layer that uses Django API when available, falls back to localStorage

import { semesterApi, courseApi, assignmentApi } from "./api"
import type { Semester, Course } from "./types"

// Check if API is available
let apiAvailable: boolean | null = null

async function checkApiAvailability(): Promise<boolean> {
  if (apiAvailable !== null) return apiAvailable

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000) // 2 second timeout

    await fetch(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/semesters/", {
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    apiAvailable = true
    console.log("[v0] Django API is available")
    return true
  } catch (error) {
    apiAvailable = false
    console.log("[v0] Django API unavailable, using localStorage fallback")
    return false
  }
}

// LocalStorage helpers
const STORAGE_KEY = "grade-calculator-semesters"

function getLocalSemesters(): Semester[] {
  if (typeof window === "undefined") return []
  const data = localStorage.getItem(STORAGE_KEY)
  return data ? JSON.parse(data) : []
}

function saveLocalSemesters(semesters: Semester[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(semesters))
}

// Unified storage API
export const storage = {
  // Semester operations
  async getSemesters(): Promise<Semester[]> {
    const isApiAvailable = await checkApiAvailability()

    if (isApiAvailable) {
      try {
        const apiSemesters = await semesterApi.getAll()
        // Convert API format to frontend format
        return apiSemesters.map((s: any) => ({
          id: s.id.toString(),
          name: s.name,
          courses: s.courses.map((c: any) => ({
            id: c.id.toString(),
            name: c.name,
            credits: c.credits,
            criteria: c.assignments.map((a: any) => ({
              id: a.id.toString(),
              name: a.name,
              weight: a.weight,
              score: (a.earned / a.total) * 100,
            })),
          })),
        }))
      } catch (error) {
        console.error("[v0] API call failed, falling back to localStorage:", error)
        return getLocalSemesters()
      }
    }

    return getLocalSemesters()
  },

  async createSemester(name: string): Promise<Semester> {
    const isApiAvailable = await checkApiAvailability()

    if (isApiAvailable) {
      try {
        const apiSemester = await semesterApi.create({ name })
        return {
          id: apiSemester.id.toString(),
          name: apiSemester.name,
          courses: [],
        }
      } catch (error) {
        console.error("[v0] API call failed, falling back to localStorage:", error)
      }
    }

    // LocalStorage fallback
    const semesters = getLocalSemesters()
    const newSemester: Semester = {
      id: Date.now().toString(),
      name,
      courses: [],
    }
    saveLocalSemesters([...semesters, newSemester])
    return newSemester
  },

  async updateSemester(id: string, name: string): Promise<void> {
    const isApiAvailable = await checkApiAvailability()

    if (isApiAvailable) {
      try {
        await semesterApi.update(id, { name })
        return
      } catch (error) {
        console.error("[v0] API call failed, falling back to localStorage:", error)
      }
    }

    // LocalStorage fallback
    const semesters = getLocalSemesters()
    const updated = semesters.map((s) => (s.id === id ? { ...s, name } : s))
    saveLocalSemesters(updated)
  },

  async deleteSemester(id: string): Promise<void> {
    const isApiAvailable = await checkApiAvailability()

    if (isApiAvailable) {
      try {
        await semesterApi.delete(id)
        return
      } catch (error) {
        console.error("[v0] API call failed, falling back to localStorage:", error)
      }
    }

    // LocalStorage fallback
    const semesters = getLocalSemesters()
    saveLocalSemesters(semesters.filter((s) => s.id !== id))
  },

  // Course operations
  async createCourse(semesterId: string, name: string, credits: number): Promise<Course> {
    const isApiAvailable = await checkApiAvailability()

    if (isApiAvailable) {
      try {
        const apiCourse = await courseApi.create({ semester: semesterId, name, credits })

        // Create default assignments
        const defaultAssignments = [
          { name: "Assignments", weight: 30, earned: 0, total: 100 },
          { name: "Midterm", weight: 30, earned: 0, total: 100 },
          { name: "Final Exam", weight: 40, earned: 0, total: 100 },
        ]

        const createdAssignments = []
        for (const assignment of defaultAssignments) {
          const a = await assignmentApi.create({
            course: apiCourse.id.toString(),
            ...assignment,
          })
          createdAssignments.push(a)
        }

        return {
          id: apiCourse.id.toString(),
          name: apiCourse.name,
          credits: apiCourse.credits,
          criteria: createdAssignments.map((a: any) => ({
            id: a.id.toString(),
            name: a.name,
            weight: a.weight,
            score: (a.earned / a.total) * 100,
          })),
          gradeScale: apiCourse.gradeScale
        }
      } catch (error) {
        console.error("[v0] API call failed, falling back to localStorage:", error)
      }
    }

    // LocalStorage fallback
    const semesters = getLocalSemesters()
    const newCourse: Course = {
      id: Date.now().toString(),
      name,
      credits,
      criteria: [
        { id: `${Date.now()}-1`, name: "Assignments", weight: 30, score: 0 },
        { id: `${Date.now()}-2`, name: "Midterm", weight: 30, score: 0 },
        { id: `${Date.now()}-3`, name: "Final Exam", weight: 40, score: 0 },
      ],
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
    }

    const updated = semesters.map((s) => (s.id === semesterId ? { ...s, courses: [...s.courses, newCourse] } : s))
    saveLocalSemesters(updated)
    return newCourse
  },

  async updateCourse(semesterId: string, course: Course): Promise<void> {
    const isApiAvailable = await checkApiAvailability()

    if (isApiAvailable) {
      try {
        await courseApi.update(course.id, { name: course.name, credits: course.credits })

        for (const criterion of course.criteria) {
          const earned = (criterion.score / 100) * 100
          await assignmentApi.update(criterion.id, {
            name: criterion.name,
            weight: criterion.weight,
            earned,
            total: 100,
          })
        }
        return
      } catch (error) {
        console.error("[v0] API call failed, falling back to localStorage:", error)
      }
    }

    // LocalStorage fallback
    const semesters = getLocalSemesters()
    const updated = semesters.map((s) =>
      s.id === semesterId ? { ...s, courses: s.courses.map((c) => (c.id === course.id ? course : c)) } : s,
    )
    saveLocalSemesters(updated)
  },

  async deleteCourse(semesterId: string, courseId: string): Promise<void> {
    const isApiAvailable = await checkApiAvailability()

    if (isApiAvailable) {
      try {
        await courseApi.delete(courseId)
        return
      } catch (error) {
        console.error("[v0] API call failed, falling back to localStorage:", error)
      }
    }

    // LocalStorage fallback
    const semesters = getLocalSemesters()
    const updated = semesters.map((s) =>
      s.id === semesterId ? { ...s, courses: s.courses.filter((c) => c.id !== courseId) } : s,
    )
    saveLocalSemesters(updated)
  },
}
