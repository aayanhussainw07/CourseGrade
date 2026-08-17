import {
  courseApi,
  extractApiList,
  localMigrationApi,
  semesterApi,
  setApiUserScope,
  userStateApi,
} from "./api"
import type { Course, Semester } from "./types"
import type { ApiUserState } from "./api"
import { apiToFrontendCourse, apiToFrontendSemester } from "./types"
import { getCriterionScore } from "./grade-utils"

const defaultAssignmentTemplates = [
  { name: "Assignments", weight: 30, earned: 0, total: 100 },
  { name: "Midterm", weight: 30, earned: 0, total: 100 },
  { name: "Final Exam", weight: 40, earned: 0, total: 100 },
]

const normalizeScore = (value: number | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) return 0
  return value
}

const DEFAULT_BACKGROUND = "sunrise"
const normalizeSubItems = (subItems: Course["criteria"][number]["subItems"]) => (subItems ? [...subItems] : [])
const CACHE_PREFIX = "coursegrade-cloud-cache-v1"
let currentUserScope = "default"
const courseSnapshotQueues = new Map<string, Promise<unknown>>()

const cacheKey = () => `${CACHE_PREFIX}:${currentUserScope}`

type CloudCache = {
  savedAt?: string
  semesters?: Semester[]
  userState?: ApiUserState
}

const readCache = (): CloudCache => {
  if (typeof window === "undefined") return {}
  try {
    const parsed = JSON.parse(localStorage.getItem(cacheKey()) ?? "null")
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

const writeCache = (updates: Partial<CloudCache>) => {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(
      cacheKey(),
      JSON.stringify({ ...readCache(), ...updates, savedAt: new Date().toISOString() }),
    )
  } catch {
    // The cache is best-effort and never authoritative.
  }
}

const cacheSemesters = (semesters: Semester[]) => {
  writeCache({ semesters })
}

const updateCachedSemesters = (update: (semesters: Semester[]) => Semester[]) => {
  cacheSemesters(update(storage.getCachedSemesters()))
}

const queueCourseSnapshot = async <T>(courseId: string, save: () => Promise<T>): Promise<T> => {
  const previous = courseSnapshotQueues.get(courseId) ?? Promise.resolve()
  const request = previous.catch(() => undefined).then(save)
  courseSnapshotQueues.set(courseId, request)
  try {
    return await request
  } finally {
    if (courseSnapshotQueues.get(courseId) === request) {
      courseSnapshotQueues.delete(courseId)
    }
  }
}

export { ApiUnavailableError } from "./api"

export const storage = {
  setUserScope(scope: string | null | undefined) {
    currentUserScope = scope && scope.trim().length > 0 ? scope.trim() : "default"
    setApiUserScope(currentUserScope)
  },

  async getSemesters(): Promise<Semester[]> {
    const apiSemesters = await semesterApi.getAll()
    const semestersArray = extractApiList(apiSemesters)
    const semesters = semestersArray.map((semester) => {
      const normalized = apiToFrontendSemester(semester)
      return {
        ...normalized,
        background: normalized.background || DEFAULT_BACKGROUND,
      }
    })
    cacheSemesters(semesters)
    return semesters
  },

  getCachedSemesters(): Semester[] {
    const cached = readCache().semesters
    return Array.isArray(cached) ? cached : []
  },

  async createSemester(name: string, timelineDate?: string | null): Promise<Semester> {
    const background = DEFAULT_BACKGROUND
    const apiSemester = await semesterApi.create({
      name,
      background,
      timeline_date: timelineDate ?? null,
    })
    const semester = {
      id: apiSemester.id.toString(),
      name: apiSemester.name,
      courses: [],
      background: apiSemester.background || background || DEFAULT_BACKGROUND,
      timelineDate: apiSemester.timeline_date ?? timelineDate ?? null,
      ignored: apiSemester.ignored ?? false,
      createdAt: apiSemester.created_at,
      updatedAt: apiSemester.updated_at,
    }
    updateCachedSemesters((semesters) => [...semesters, semester])
    return semester
  },

  async updateSemester(
    id: string,
    updates: Partial<{ name: string; background: string; timelineDate: string | null; ignored: boolean }>,
  ): Promise<void> {
    const payload: {
      name?: string
      background?: string
      timeline_date?: string | null
      ignored?: boolean
    } = {}
    if (typeof updates.name === "string") payload.name = updates.name
    if (typeof updates.background === "string") payload.background = updates.background
    if ("timelineDate" in updates) payload.timeline_date = updates.timelineDate ?? null
    if (typeof updates.ignored === "boolean") payload.ignored = updates.ignored
    await semesterApi.update(id, payload)
    updateCachedSemesters((semesters) =>
      semesters.map((semester) => semester.id === id ? { ...semester, ...updates } : semester),
    )
  },

  async deleteSemester(id: string): Promise<void> {
    await semesterApi.delete(id)
    updateCachedSemesters((semesters) => semesters.filter((semester) => semester.id !== id))
  },

  async createCourse(
    semesterId: string,
    name: string,
    credits: number,
    headerColor?: string | null,
  ): Promise<Course> {
    const apiCourse = await courseApi.create({
      semester: semesterId,
      name,
      credits,
      is_pass_fail: false,
      percent_boost: 0,
      header_color: headerColor ?? null,
      assignments: [],
    })

    const createdCourse = apiToFrontendCourse(apiCourse)
    createdCourse.collapsed = false
    createdCourse.isPassFail = false
    createdCourse.percentBoost = 0
    createdCourse.headerColor = headerColor ?? createdCourse.headerColor ?? null
    updateCachedSemesters((semesters) =>
      semesters.map((semester) =>
        semester.id === semesterId
          ? { ...semester, courses: [...semester.courses, createdCourse] }
          : semester,
      ),
    )
    return createdCourse
  },

  async updateCourse(_semesterId: string, course: Course): Promise<Course> {
    const currentCriteria = Array.isArray(course.criteria) ? course.criteria : []
    const letterGradeScale = course.isPassFail
      ? course.gradeScaleSnapshot ?? course.gradeScale
      : course.gradeScale
    const apiCourse = await queueCourseSnapshot(course.id, () => courseApi.update(course.id, {
      name: course.name,
      credits: course.credits,
      is_pass_fail: course.isPassFail ?? false,
      percent_boost: course.percentBoost ?? 0,
      header_color: course.headerColor ?? null,
      pass_label: course.passLabel ?? "P",
      fail_label: course.failLabel ?? "F",
      pass_threshold: course.passThreshold ?? 60,
      pass_color: course.passColor ?? "#888888",
      fail_color: course.failColor ?? "#8a8a8a",
      letter_grade_scale: letterGradeScale,
      assignments: currentCriteria.map((criterion) => ({
        client_id: criterion.clientId ?? criterion.id,
        name: typeof criterion.name === "string" ? criterion.name : "",
        weight: Math.min(Math.max(criterion.weight, 0), 100),
        earned: normalizeScore(getCriterionScore(criterion)),
        total: 100,
        drop_lowest: criterion.dropLowest ?? 0,
        extra_credit: criterion.extraCredit ?? 0,
        sub_items: normalizeSubItems(criterion.subItems),
      })),
    }))
    const syncedCourse = { ...apiToFrontendCourse(apiCourse), collapsed: course.collapsed }
    updateCachedSemesters((semesters) =>
      semesters.map((semester) => ({
        ...semester,
        courses: semester.courses.map((cachedCourse) =>
          cachedCourse.id === course.id ? syncedCourse : cachedCourse,
        ),
      })),
    )
    return syncedCourse
  },

  async deleteCourse(_semesterId: string, id: string): Promise<void> {
    await courseApi.delete(id)
    updateCachedSemesters((semesters) =>
      semesters.map((semester) => ({
        ...semester,
        courses: semester.courses.filter((course) => course.id !== id),
      })),
    )
  },

  async reorderSemesters(ids: string[]): Promise<void> {
    await semesterApi.reorder(ids)
    updateCachedSemesters((semesters) => {
      const map = new Map(semesters.map((semester) => [semester.id, semester]))
      return ids.map((id) => map.get(id)).filter((semester): semester is Semester => Boolean(semester))
    })
  },

  async reorderCourses(semesterId: string, ids: string[]): Promise<void> {
    await courseApi.reorder(semesterId, ids)
    updateCachedSemesters((semesters) =>
      semesters.map((semester) => {
        if (semester.id !== semesterId) return semester
        const map = new Map(semester.courses.map((course) => [course.id, course]))
        return {
          ...semester,
          courses: ids.map((id) => map.get(id)).filter((course): course is Course => Boolean(course)),
        }
      }),
    )
  },

  async getUserState() {
    const state = await userStateApi.get()
    writeCache({ userState: state })
    return state
  },

  getCachedUserState(): ApiUserState | null {
    return readCache().userState ?? null
  },

  async updateUserState(data: Parameters<typeof userStateApi.update>[0]) {
    const state = await userStateApi.update(data)
    writeCache({ userState: state })
    return state
  },
  migrateLegacyLocalState: localMigrationApi.migrate,
}
