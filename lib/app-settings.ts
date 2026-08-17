import type { GradeScale } from "./types"
import { DEFAULT_GRADE_SCALE } from "./types"
import { normalizeGradeScaleMetadata } from "./grade-utils"
import { settingsApi } from "./api"
import {
  DEFAULT_ONBOARDING_PROGRESS,
  normalizeOnboardingProgress,
  type OnboardingProgress,
} from "./onboarding"

const APP_SETTINGS_KEY = "coursegrade:app-settings"
let settingsSaveQueue: Promise<void> = Promise.resolve()

export interface AppSettings {
  defaultCredits: number
  defaultGradeScale: GradeScale[]
  defaultIsPassFail: boolean
  defaultPassLabel: string
  defaultFailLabel: string
  defaultPassThreshold: number
  defaultPassColor: string
  defaultFailColor: string
  collapseCoursesOnSemesterOpen: boolean
  skipSemesterDeleteConfirm: boolean
  skipCourseDeleteConfirm: boolean
  school: "general" | "cornell"
  onboarding: OnboardingProgress
}

const DEFAULT_APP_SETTINGS: AppSettings = {
  defaultCredits: 3,
  defaultGradeScale: DEFAULT_GRADE_SCALE,
  defaultIsPassFail: false,
  defaultPassLabel: "P",
  defaultFailLabel: "F",
  defaultPassThreshold: 60,
  defaultPassColor: "#888888",
  defaultFailColor: "#8a8a8a",
  collapseCoursesOnSemesterOpen: true,
  skipSemesterDeleteConfirm: false,
  skipCourseDeleteConfirm: false,
  school: "general",
  onboarding: DEFAULT_ONBOARDING_PROGRESS,
}

type LegacyAppSettings = Partial<AppSettings> & {
  defaultGradeScaleSnapshot?: unknown
  aPlusGpaValue?: unknown
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
  const rawScale = legacySnapshot
    ? legacySnapshot
    : storedScale && !isLegacyPassFailScale(storedScale, stored)
      ? storedScale
      : DEFAULT_GRADE_SCALE.map((grade) => ({ ...grade }))
  const legacyAPlusValue =
    typeof stored.aPlusGpaValue === "number" &&
    Number.isFinite(stored.aPlusGpaValue) &&
    stored.aPlusGpaValue >= 0
      ? stored.aPlusGpaValue
      : 4.33
  const scaleForMigration = !storedScale && !legacySnapshot && "aPlusGpaValue" in stored
    ? rawScale.map((grade) => grade.letter === "A+" ? { ...grade, gpa: legacyAPlusValue } : grade)
    : rawScale
  const defaultGradeScale = normalizeGradeScaleMetadata(scaleForMigration, legacyAPlusValue)
  const collapseCoursesOnSemesterOpen =
    typeof stored.collapseCoursesOnSemesterOpen === "boolean"
      ? stored.collapseCoursesOnSemesterOpen
      : DEFAULT_APP_SETTINGS.collapseCoursesOnSemesterOpen
  const onboarding = normalizeOnboardingProgress(stored.onboarding)
  const defaultPassColor =
    typeof stored.defaultPassColor === "string" && /^#[0-9a-f]{6}$/i.test(stored.defaultPassColor)
      ? stored.defaultPassColor.toLowerCase()
      : DEFAULT_APP_SETTINGS.defaultPassColor
  const defaultFailColor =
    typeof stored.defaultFailColor === "string" && /^#[0-9a-f]{6}$/i.test(stored.defaultFailColor)
      ? stored.defaultFailColor.toLowerCase()
      : DEFAULT_APP_SETTINGS.defaultFailColor
  const merged = {
    ...DEFAULT_APP_SETTINGS,
    ...stored,
    defaultGradeScale,
    collapseCoursesOnSemesterOpen,
    defaultPassColor,
    defaultFailColor,
    onboarding,
  } as AppSettings & { defaultGradeScaleSnapshot?: unknown; aPlusGpaValue?: unknown }
  delete merged.defaultGradeScaleSnapshot
  delete merged.aPlusGpaValue
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
    const defaults = normalizeAppSettings(undefined)
    localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(defaults))
    return defaults
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
