import type { GradeScale } from "./types"
import { DEFAULT_GRADE_SCALE } from "./types"
import { settingsApi } from "./api"

const APP_SETTINGS_KEY = "coursegrade:app-settings"
let settingsSaveQueue: Promise<void> = Promise.resolve()

export interface AppSettings {
  defaultCredits: number
  aPlusGpaValue: number // 4.0 or 4.33
  defaultGradeScale: GradeScale[]
  defaultIsPassFail: boolean
  defaultPassLabel: string
  defaultFailLabel: string
  defaultPassThreshold: number
  collapseCoursesOnSemesterOpen: boolean
  skipSemesterDeleteConfirm: boolean
  skipCourseDeleteConfirm: boolean
  school: "general" | "cornell"
}

const DEFAULT_APP_SETTINGS: AppSettings = {
  defaultCredits: 3,
  aPlusGpaValue: 4.3,
  defaultGradeScale: DEFAULT_GRADE_SCALE,
  defaultIsPassFail: false,
  defaultPassLabel: "P",
  defaultFailLabel: "F",
  defaultPassThreshold: 60,
  collapseCoursesOnSemesterOpen: true,
  skipSemesterDeleteConfirm: false,
  skipCourseDeleteConfirm: false,
  school: "general",
}

type LegacyAppSettings = Partial<AppSettings> & {
  defaultGradeScaleSnapshot?: unknown
}

const cloneValidGradeScale = (value: unknown): GradeScale[] | null => {
  if (!Array.isArray(value) || value.length === 0) return null
  const valid = value.every(
    (grade) =>
      typeof grade === "object" &&
      grade !== null &&
      typeof (grade as GradeScale).letter === "string" &&
      typeof (grade as GradeScale).min === "number" &&
      Number.isFinite((grade as GradeScale).min),
  )
  return valid ? value.map((grade) => ({ ...(grade as GradeScale) })) : null
}

const isLegacyPassFailScale = (
  scale: GradeScale[],
  settings: LegacyAppSettings,
) => {
  if (!settings.defaultIsPassFail || scale.length !== 2) return false
  const passLabel = settings.defaultPassLabel?.trim() || "P"
  const failLabel = settings.defaultFailLabel?.trim() || "F"
  const threshold = Math.min(
    100,
    Math.max(0, settings.defaultPassThreshold ?? 60),
  )
  return (
    scale[0].letter === passLabel &&
    scale[0].min === threshold &&
    scale[1].letter === failLabel &&
    scale[1].min === 0
  )
}

export function normalizeAppSettings(value: unknown): AppSettings {
  const stored =
    typeof value === "object" && value !== null
      ? (value as LegacyAppSettings)
      : {}
  const storedScale = cloneValidGradeScale(stored.defaultGradeScale)
  const legacySnapshot = cloneValidGradeScale(
    stored.defaultGradeScaleSnapshot,
  )
  const defaultGradeScale = legacySnapshot
    ? legacySnapshot
    : storedScale && !isLegacyPassFailScale(storedScale, stored)
      ? storedScale
      : DEFAULT_GRADE_SCALE.map((grade) => ({ ...grade }))
  const collapseCoursesOnSemesterOpen =
    typeof stored.collapseCoursesOnSemesterOpen === "boolean"
      ? stored.collapseCoursesOnSemesterOpen
      : DEFAULT_APP_SETTINGS.collapseCoursesOnSemesterOpen
  const merged = {
    ...DEFAULT_APP_SETTINGS,
    ...stored,
    defaultGradeScale,
    collapseCoursesOnSemesterOpen,
  } as AppSettings & { defaultGradeScaleSnapshot?: unknown }
  delete merged.defaultGradeScaleSnapshot
  return merged
}

export function loadAppSettings(): AppSettings {
  if (typeof window === "undefined") return normalizeAppSettings(undefined)
  try {
    const raw = localStorage.getItem(APP_SETTINGS_KEY)
    if (!raw) return normalizeAppSettings(undefined)
    return normalizeAppSettings(JSON.parse(raw))
  } catch {
    return normalizeAppSettings(undefined)
  }
}

export function saveAppSettings(updates: Partial<AppSettings>): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  const current = loadAppSettings()
  const merged = normalizeAppSettings({ ...current, ...updates })
  localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(merged))

  const request = settingsSaveQueue
    .catch(() => undefined)
    .then(() => settingsApi.save({ ...merged }))
    .then(() => undefined)
  settingsSaveQueue = request
  return request
}

export async function loadAppSettingsFromServer(): Promise<AppSettings> {
  try {
    const remote = await settingsApi.get()
    if (remote && Object.keys(remote).length > 0) {
      const merged = normalizeAppSettings(remote)
      localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(merged))
      return merged
    }
  } catch {
    // fall through to local
  }
  return loadAppSettings()
}

export function clearAppSettings(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(APP_SETTINGS_KEY)
  settingsApi.save({}).catch(() => {})
}
