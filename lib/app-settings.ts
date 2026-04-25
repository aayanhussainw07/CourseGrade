import type { GradeScale } from "./types"
import { DEFAULT_GRADE_SCALE } from "./types"

const APP_SETTINGS_KEY = "coursegrade:app-settings"

export interface AppSettings {
  defaultCredits: number
  aPlusGpaValue: number // 4.0 or 4.33
  defaultGradeScale: GradeScale[]
  skipSemesterDeleteConfirm: boolean
}

const DEFAULT_APP_SETTINGS: AppSettings = {
  defaultCredits: 3,
  aPlusGpaValue: 4.3,
  defaultGradeScale: DEFAULT_GRADE_SCALE,
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
  localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify({ ...current, ...updates }))
}

export function clearAppSettings(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(APP_SETTINGS_KEY)
}
