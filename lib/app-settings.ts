import type { GradeScale } from "./types"
import { DEFAULT_GRADE_SCALE } from "./types"
import { settingsApi } from "./api"

const APP_SETTINGS_KEY = "coursegrade:app-settings"

export interface AppSettings {
  defaultCredits: number
  aPlusGpaValue: number // 4.0 or 4.33
  defaultGradeScale: GradeScale[]
  defaultGradeScaleSnapshot?: GradeScale[]
  defaultIsPassFail: boolean
  defaultPassLabel: string
  defaultFailLabel: string
  defaultPassThreshold: number
  skipSemesterDeleteConfirm: boolean
}

const DEFAULT_APP_SETTINGS: AppSettings = {
  defaultCredits: 3,
  aPlusGpaValue: 4.3,
  defaultGradeScale: DEFAULT_GRADE_SCALE,
  defaultGradeScaleSnapshot: undefined,
  defaultIsPassFail: false,
  defaultPassLabel: "P",
  defaultFailLabel: "F",
  defaultPassThreshold: 60,
  skipSemesterDeleteConfirm: false,
}

export function loadAppSettings(): AppSettings {
  if (typeof window === "undefined") return { ...DEFAULT_APP_SETTINGS }
  try {
    const raw = localStorage.getItem(APP_SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_APP_SETTINGS }
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_APP_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_APP_SETTINGS }
  }
}

export function saveAppSettings(updates: Partial<AppSettings>): void {
  if (typeof window === "undefined") return
  const current = loadAppSettings()
  const merged = { ...current, ...updates }
  localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(merged))
  settingsApi.save(merged).catch(() => {})
}

export async function loadAppSettingsFromServer(): Promise<AppSettings> {
  try {
    const remote = await settingsApi.get()
    if (remote && Object.keys(remote).length > 0) {
      const merged = { ...DEFAULT_APP_SETTINGS, ...remote } as AppSettings
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
