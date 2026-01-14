import { semesterApi, courseApi, assignmentApi, setApiUserScope } from "./api"
import { backgroundOptions } from "./backgrounds"
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
    const scores = criterion.subItems.map((item) => item.score || 0)
    const drop = Math.min(criterion.dropLowest || 0, Math.max(scores.length - 1, 0))
    const sorted = [...scores].sort((a, b) => a - b)
    const kept = sorted.slice(drop)
    if (kept.length === 0) return 0
    const total = kept.reduce((sum, value) => sum + value, 0)
    return total / kept.length
  }
  return criterion.score
}

const isServerAssignmentId = (id: string) => /^\d+$/.test(id)
const DEFAULT_BACKGROUND = backgroundOptions[0]?.id ?? "sunrise"
const getRandomBackgroundId = () => {
  if (!backgroundOptions.length) return DEFAULT_BACKGROUND
  const randomIndex = Math.floor(Math.random() * backgroundOptions.length)
  return backgroundOptions[randomIndex]?.id ?? DEFAULT_BACKGROUND
}

export { ApiUnavailableError } from "./api"

export const storage = {
  setUserScope(scope: string | null | undefined) {
    setApiUserScope(scope && scope.trim().length > 0 ? scope.trim() : "default")
  },

  async getSemesters(): Promise<Semester[]> {
    const apiSemesters = await semesterApi.getAll()
    const semestersArray = Array.isArray(apiSemesters) ? apiSemesters : apiSemesters?.results ?? []
    return semestersArray.map((semester) => {
      const normalized = apiToFrontendSemester(semester)
      return {
        ...normalized,
        background: normalized.background || DEFAULT_BACKGROUND,
      }
    })
  },

  async createSemester(name: string, timelineDate?: string | null): Promise<Semester> {
    const background = getRandomBackgroundId()
    const apiSemester = await semesterApi.create({
      name,
      background,
      timeline_date: timelineDate ?? null,
    })
    return {
      id: apiSemester.id.toString(),
      name: apiSemester.name,
      courses: [],
      background: apiSemester.background || background || DEFAULT_BACKGROUND,
      timelineDate: apiSemester.timeline_date ?? timelineDate ?? null,
      createdAt: apiSemester.created_at,
      updatedAt: apiSemester.updated_at,
    }
  },

  async updateSemester(
    id: string,
    updates: Partial<{ name: string; background: string; timelineDate: string | null }>,
  ): Promise<void> {
    const payload: {
      name?: string
      background?: string
      timeline_date?: string | null
    } = {}
    if (typeof updates.name === "string") payload.name = updates.name
    if (typeof updates.background === "string") payload.background = updates.background
    if ("timelineDate" in updates) payload.timeline_date = updates.timelineDate ?? null
    await semesterApi.update(id, payload)
  },

  async deleteSemester(id: string): Promise<void> {
    await semesterApi.delete(id)
  },

  async createCourse(semesterId: string, name: string, credits: number): Promise<Course> {
    const apiCourse = await courseApi.create({
      semester: semesterId,
      name,
      credits,
      is_pass_fail: false,
      percent_boost: 0,
    })

    for (const assignment of defaultAssignmentTemplates) {
      await assignmentApi.create({
        course: apiCourse.id.toString(),
        ...assignment,
        drop_lowest: 0,
      })
    }

    const refreshed = await courseApi.getOne(apiCourse.id.toString())
    const createdCourse = apiToFrontendCourse(refreshed)
    createdCourse.collapsed = false
    createdCourse.isPassFail = false
    createdCourse.percentBoost = createdCourse.percentBoost ?? 0
    return createdCourse
  },

  async updateCourse(_semesterId: string, course: Course): Promise<Course> {
    const currentCriteria = Array.isArray(course.criteria) ? course.criteria : []
    await courseApi.update(course.id, {
      name: course.name,
      credits: course.credits,
      is_pass_fail: course.isPassFail ?? false,
      percent_boost: course.percentBoost ?? 0,
    })

    const assignmentsResponse = await assignmentApi.getAll(course.id)
    const existingAssignments = Array.isArray(assignmentsResponse)
      ? assignmentsResponse
      : assignmentsResponse?.results ?? []
    const existingIds = new Set(existingAssignments.map((a: any) => a.id.toString()))
    const desiredIds = new Set<string>()
    const subItemsSnapshot = new Map<string, Course["criteria"][number]["subItems"]>()
    const clientIdMap = new Map<string, string>()
    const originalCriteriaByClientId = new Map<string, Course["criteria"][number]>()

    for (const criterion of currentCriteria) {
      const criterionName = typeof criterion.name === "string" ? criterion.name : ""
      const clientId = criterion.clientId ?? criterion.id
      originalCriteriaByClientId.set(clientId, criterion)
      const snapshot = criterion.subItems ? [...criterion.subItems] : undefined
      const payload = {
        name: criterionName,
        weight: criterion.weight,
        earned: normalizeScore(getCriterionScoreValue(criterion)),
        total: 100,
        drop_lowest: criterion.dropLowest ?? 0,
      }

      if (criterion.id && isServerAssignmentId(criterion.id) && existingIds.has(criterion.id)) {
        await assignmentApi.update(criterion.id, payload)
        desiredIds.add(criterion.id)
        clientIdMap.set(criterion.id, clientId)
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
        clientIdMap.set(newId, clientId)
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
    frontendCourse.gradeScaleSnapshot = course.gradeScaleSnapshot
      ? course.gradeScaleSnapshot.map((grade) => ({ ...grade }))
      : undefined
    frontendCourse.collapsed = course.collapsed ?? false
    frontendCourse.isPassFail = course.isPassFail ?? false
    frontendCourse.passLabel = course.passLabel ?? "P"
    frontendCourse.failLabel = course.failLabel ?? "F"
    frontendCourse.passThreshold = course.passThreshold ?? 60
    frontendCourse.cardColor = course.cardColor ?? null
    frontendCourse.percentBoost = course.percentBoost ?? frontendCourse.percentBoost ?? 0
    frontendCourse.criteria = frontendCourse.criteria.map((criterion, index) => {
      const mappedClientId = clientIdMap.get(criterion.id) ?? criterion.id
      const originalCriterion =
        originalCriteriaByClientId.get(mappedClientId) ?? currentCriteria[index] ?? null
      return {
        ...criterion,
        clientId: mappedClientId,
        subItems: subItemsSnapshot.get(criterion.id) ?? [],
        dropLowest: originalCriterion?.dropLowest ?? criterion.dropLowest ?? 0,
        extraCredit: originalCriterion?.extraCredit ?? criterion.extraCredit ?? 0,
      }
    })
    return frontendCourse
  },

  async deleteCourse(_semesterId: string, id: string): Promise<void> {
    await courseApi.delete(id)
  },
}
