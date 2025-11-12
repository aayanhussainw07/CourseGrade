import { semesterApi, courseApi, assignmentApi, setApiUserScope } from "./api"
import type { Course, Semester } from "./types"
import { apiToFrontendCourse, apiToFrontendSemester } from "./types"

const defaultAssignmentTemplates = [
  { name: "Assignments", weight: 30, earned: 0, total: 100 },
  { name: "Midterm", weight: 30, earned: 0, total: 100 },
  { name: "Final Exam", weight: 40, earned: 0, total: 100 },
]

const normalizeScore = (value: number | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) return 0
  return value
}

const getCriterionScoreValue = (criterion: Course["criteria"][number]) => {
  if (criterion.subItems && criterion.subItems.length > 0) {
    const total = criterion.subItems.reduce((sum, item) => sum + (item.score || 0), 0)
    return total / criterion.subItems.length
  }
  return criterion.score
}

const isServerAssignmentId = (id: string) => /^\d+$/.test(id)

export { ApiUnavailableError } from "./api"

export const storage = {
  setUserScope(scope: string | null | undefined) {
    setApiUserScope(scope && scope.trim().length > 0 ? scope.trim() : "default")
  },

  async getSemesters(): Promise<Semester[]> {
    const apiSemesters = await semesterApi.getAll()
    const semestersArray = Array.isArray(apiSemesters) ? apiSemesters : apiSemesters?.results ?? []
    return semestersArray.map(apiToFrontendSemester)
  },

  async createSemester(name: string): Promise<Semester> {
    const apiSemester = await semesterApi.create({ name })
    return {
      id: apiSemester.id.toString(),
      name: apiSemester.name,
      courses: [],
    }
  },

  async updateSemester(id: string, name: string): Promise<void> {
    await semesterApi.update(id, { name })
  },

  async deleteSemester(id: string): Promise<void> {
    await semesterApi.delete(id)
  },

  async createCourse(semesterId: string, name: string, credits: number): Promise<Course> {
    const apiCourse = await courseApi.create({ semester: semesterId, name, credits })

    for (const assignment of defaultAssignmentTemplates) {
      await assignmentApi.create({
        course: apiCourse.id.toString(),
        ...assignment,
      })
    }

    const refreshed = await courseApi.getOne(apiCourse.id.toString())
    const createdCourse = apiToFrontendCourse(refreshed)
    createdCourse.collapsed = false
    return createdCourse
  },

  async updateCourse(_semesterId: string, course: Course): Promise<Course> {
    await courseApi.update(course.id, {
      name: course.name,
      credits: course.credits,
    })

    const assignmentsResponse = await assignmentApi.getAll(course.id)
    const existingAssignments = Array.isArray(assignmentsResponse)
      ? assignmentsResponse
      : assignmentsResponse?.results ?? []
    const existingIds = new Set(existingAssignments.map((a: any) => a.id.toString()))
    const desiredIds = new Set<string>()
    const subItemsSnapshot = new Map<string, Course["criteria"][number]["subItems"]>()

    for (const criterion of course.criteria) {
      const snapshot = criterion.subItems ? [...criterion.subItems] : undefined
      const payload = {
        name: criterion.name,
        weight: criterion.weight,
        earned: normalizeScore(getCriterionScoreValue(criterion)),
        total: 100,
      }

      if (criterion.id && isServerAssignmentId(criterion.id) && existingIds.has(criterion.id)) {
        await assignmentApi.update(criterion.id, payload)
        desiredIds.add(criterion.id)
        if (snapshot) {
          subItemsSnapshot.set(criterion.id, snapshot)
        } else {
          subItemsSnapshot.set(criterion.id, [])
        }
      } else {
        const created = await assignmentApi.create({
          course: course.id,
          ...payload,
        })
        const newId = created.id.toString()
        desiredIds.add(newId)
        if (snapshot) {
          subItemsSnapshot.set(newId, snapshot)
        } else {
          subItemsSnapshot.set(newId, [])
        }
      }
    }

    for (const assignment of existingAssignments) {
      const assignmentId = assignment.id.toString()
      if (!desiredIds.has(assignmentId)) {
        await assignmentApi.delete(assignmentId)
      }
    }

    const refreshed = await courseApi.getOne(course.id)
    const frontendCourse = apiToFrontendCourse(refreshed)
    frontendCourse.gradeScale = course.gradeScale
    frontendCourse.collapsed = course.collapsed ?? false
    frontendCourse.criteria = frontendCourse.criteria.map((criterion) => ({
      ...criterion,
      subItems: subItemsSnapshot.get(criterion.id) ?? [],
    }))
    return frontendCourse
  },

  async deleteCourse(_semesterId: string, id: string): Promise<void> {
    await courseApi.delete(id)
  },
}
