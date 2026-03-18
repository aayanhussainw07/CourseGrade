import { assignmentApi, courseApi, extractApiList, semesterApi, setApiUserScope } from "./api"
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
const DEFAULT_BACKGROUND = "sunrise"
const normalizeSubItems = (subItems: Course["criteria"][number]["subItems"]) => (subItems ? [...subItems] : [])

export { ApiUnavailableError } from "./api"

export const storage = {
  setUserScope(scope: string | null | undefined) {
    setApiUserScope(scope && scope.trim().length > 0 ? scope.trim() : "default")
  },

  async getSemesters(): Promise<Semester[]> {
    const apiSemesters = await semesterApi.getAll()
    const semestersArray = extractApiList(apiSemesters)
    return semestersArray.map((semester) => {
      const normalized = apiToFrontendSemester(semester)
      return {
        ...normalized,
        background: normalized.background || DEFAULT_BACKGROUND,
      }
    })
  },

  async createSemester(name: string, timelineDate?: string | null): Promise<Semester> {
    const background = DEFAULT_BACKGROUND
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
    const templateAssignments = defaultAssignmentTemplates.map((assignment) => ({
      ...assignment,
      drop_lowest: 0,
    }))

    const apiCourse = await courseApi.create({
      semester: semesterId,
      name,
      credits,
      is_pass_fail: false,
      percent_boost: 0,
      assignments: templateAssignments,
    })

    let hydratedCourse = apiCourse
    if (!Array.isArray(apiCourse.assignments) || apiCourse.assignments.length === 0) {
      await Promise.all(
        templateAssignments.map((assignment) =>
          assignmentApi.create({
            course: apiCourse.id.toString(),
            ...assignment,
          }),
        ),
      )
      hydratedCourse = await courseApi.getOne(apiCourse.id.toString())
    }

    const createdCourse = apiToFrontendCourse(hydratedCourse)
    createdCourse.collapsed = false
    createdCourse.isPassFail = false
    createdCourse.percentBoost = createdCourse.percentBoost ?? 0
    return createdCourse
  },

  async updateCourse(_semesterId: string, course: Course): Promise<Course> {
    const currentCriteria = Array.isArray(course.criteria) ? course.criteria : []

    // Fetch existing assignments and update course metadata in parallel
    const [, assignmentsResponse] = await Promise.all([
      courseApi.update(course.id, {
        name: course.name,
        credits: course.credits,
        is_pass_fail: course.isPassFail ?? false,
        percent_boost: course.percentBoost ?? 0,
      }),
      assignmentApi.getAll(course.id),
    ])

    const existingAssignments = extractApiList(assignmentsResponse)
    const existingIds = new Set(existingAssignments.map((a) => a.id.toString()))

    // Update/create all criteria in parallel
    const criterionResults = await Promise.all(
      currentCriteria.map(async (criterion) => {
        const clientId = criterion.clientId ?? criterion.id
        const snapshot = normalizeSubItems(criterion.subItems)
        const payload = {
          name: typeof criterion.name === "string" ? criterion.name : "",
          weight: Math.min(criterion.weight, 100),
          earned: normalizeScore(getCriterionScoreValue(criterion)),
          total: 100,
          drop_lowest: criterion.dropLowest ?? 0,
        }

        if (criterion.id && isServerAssignmentId(criterion.id) && existingIds.has(criterion.id)) {
          let serverId = criterion.id
          try {
            await assignmentApi.update(criterion.id, payload)
          } catch (e) {
            if (e instanceof Error && e.message === "Not found.") {
              const created = await assignmentApi.create({ course: course.id, ...payload })
              serverId = created.id.toString()
            } else {
              throw e
            }
          }
          return { serverId, clientId, snapshot, criterion }
        } else {
          const created = await assignmentApi.create({ course: course.id, ...payload })
          return { serverId: created.id.toString(), clientId, snapshot, criterion }
        }
      }),
    )

    const desiredIds = new Set(criterionResults.map((r) => r.serverId))

    // Delete removed assignments in parallel
    await Promise.all(
      existingAssignments
        .filter((a) => !desiredIds.has(a.id.toString()))
        .map(async (a) => {
          try {
            await assignmentApi.delete(a.id.toString())
          } catch (e) {
            if (!(e instanceof Error && e.message === "Not found.")) {
              throw e
            }
          }
        }),
    )

    // Build result directly from client state + server IDs — no extra round trip needed
    return {
      ...course,
      criteria: criterionResults.map(({ serverId, clientId, snapshot, criterion }) => ({
        ...criterion,
        id: serverId,
        clientId,
        subItems: snapshot,
      })),
    }
  },

  async deleteCourse(_semesterId: string, id: string): Promise<void> {
    await courseApi.delete(id)
  },
}
