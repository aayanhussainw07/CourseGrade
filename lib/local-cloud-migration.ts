import {
  ACTIVE_SEMESTER_STORAGE_KEY,
  COURSE_SETTINGS_STORAGE_KEY,
  DASHBOARD_SENTINEL,
  SEMESTER_ORDER_STORAGE_KEY,
  readStoredDashboardMessage,
  readStoredSemesterOrder,
  writeStoredDashboardMessage,
} from "@/app/page-utils"
import { readStoredCourseSettings } from "@/lib/course-settings"
import { storage } from "@/lib/storage"
import type { Semester } from "@/lib/types"

const LOCAL_MIGRATION_VERSION = 1

const clearLegacyKeys = (scopeId: string) => {
  localStorage.removeItem(SEMESTER_ORDER_STORAGE_KEY)
  localStorage.removeItem(ACTIVE_SEMESTER_STORAGE_KEY)
  localStorage.removeItem(COURSE_SETTINGS_STORAGE_KEY)
  writeStoredDashboardMessage(scopeId, "")
}

export async function migrateLegacyBrowserState(
  semesters: Semester[],
  scopeId: string,
): Promise<{ migrated: boolean; dashboardMessage: string | null; activeSemesterId: string | null }> {
  const cloudState = await storage.getUserState()
  if (cloudState.local_migration_version >= LOCAL_MIGRATION_VERSION) {
    clearLegacyKeys(scopeId)
    return {
      migrated: false,
      dashboardMessage: cloudState.dashboard_message,
      activeSemesterId: cloudState.last_active_semester_id?.toString() ?? null,
    }
  }

  const cloudIds = semesters.map((semester) => semester.id)
  const legacyOrder = readStoredSemesterOrder()
  const seenOrderIds = new Set<string>()
  const semesterOrder = [
    ...legacyOrder.filter((id) => {
      if (!cloudIds.includes(id) || seenOrderIds.has(id)) return false
      seenOrderIds.add(id)
      return true
    }),
    ...cloudIds.filter((id) => !legacyOrder.includes(id)),
  ]
  const legacyActive = localStorage.getItem(ACTIVE_SEMESTER_STORAGE_KEY)
  const activeSemesterId =
    legacyActive === DASHBOARD_SENTINEL || (legacyActive && cloudIds.includes(legacyActive))
      ? legacyActive
      : cloudIds[0] ?? DASHBOARD_SENTINEL
  const dashboardMessage = readStoredDashboardMessage(scopeId)
  const courseSettings = readStoredCourseSettings()

  await storage.migrateLegacyLocalState({
    scope: "user",
    payload: {
      semester_order: semesterOrder,
      active_semester_id: activeSemesterId,
      dashboard_message: dashboardMessage,
    },
  })

  const cloudCourseIds = new Set(
    semesters.flatMap((semester) => semester.courses.map((course) => course.id)),
  )
  for (const [courseId, payload] of Object.entries(courseSettings)) {
    if (!cloudCourseIds.has(courseId)) continue
    await storage.migrateLegacyLocalState({
      scope: "course",
      course_id: courseId,
      payload: payload as unknown as Record<string, unknown>,
    })
  }

  const finalized = await storage.migrateLegacyLocalState({
    scope: "finalize",
    payload: { completed_at: new Date().toISOString() },
  })

  clearLegacyKeys(scopeId)

  return {
    migrated: true,
    dashboardMessage: finalized.dashboard_message,
    activeSemesterId: finalized.last_active_semester_id?.toString() ?? null,
  }
}
