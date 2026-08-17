import type { Criterion } from "./types"

export const ONBOARDING_VERSION = 1

export type OnboardingStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "dismissed"

export type CoreOnboardingStep =
  | "welcome"
  | "add_semester"
  | "rename_semester"
  | "add_course"
  | "open_course"
  | "customize_course"
  | "add_criterion"
  | "configure_criterion"
  | "grade_result"
  | "navigation"
  | "dashboard_link"
  | "dashboard_finish"

export interface OnboardingProgress {
  version: number
  coreStatus: OnboardingStatus
  coreStep: CoreOnboardingStep
  semesterId?: string
  courseId?: string
  initialSemesterName?: string
  initialCourseName?: string
  criterionScoreEntered: boolean
  coreSetupRequired: boolean
}

export const DEFAULT_ONBOARDING_PROGRESS: OnboardingProgress = {
  version: ONBOARDING_VERSION,
  coreStatus: "not_started",
  coreStep: "welcome",
  criterionScoreEntered: false,
  coreSetupRequired: true,
}

const CORE_STEPS = new Set<CoreOnboardingStep>([
  "welcome",
  "add_semester",
  "rename_semester",
  "add_course",
  "open_course",
  "customize_course",
  "add_criterion",
  "configure_criterion",
  "grade_result",
  "navigation",
  "dashboard_link",
  "dashboard_finish",
])

const STATUSES = new Set<OnboardingStatus>([
  "not_started",
  "in_progress",
  "completed",
  "dismissed",
])

const optionalString = (value: unknown) =>
  typeof value === "string" && value.length > 0 ? value : undefined

export function normalizeOnboardingProgress(value: unknown): OnboardingProgress {
  if (typeof value !== "object" || value === null) {
    return { ...DEFAULT_ONBOARDING_PROGRESS }
  }

  const stored = value as Partial<OnboardingProgress>
  if (stored.version !== ONBOARDING_VERSION) {
    return { ...DEFAULT_ONBOARDING_PROGRESS }
  }

  return {
    version: ONBOARDING_VERSION,
    coreStatus: STATUSES.has(stored.coreStatus as OnboardingStatus)
      ? (stored.coreStatus as OnboardingStatus)
      : "not_started",
    coreStep: CORE_STEPS.has(stored.coreStep as CoreOnboardingStep)
      ? (stored.coreStep as CoreOnboardingStep)
      : "welcome",
    semesterId: optionalString(stored.semesterId),
    courseId: optionalString(stored.courseId),
    initialSemesterName: optionalString(stored.initialSemesterName),
    initialCourseName: optionalString(stored.initialCourseName),
    criterionScoreEntered: stored.criterionScoreEntered === true,
    coreSetupRequired: stored.coreSetupRequired !== false,
  }
}

export function isAutomaticOnboardingEligible({
  authenticated,
  settingsLoaded,
  dataLoaded,
  serverOffline,
  semesterCount,
  progress,
}: {
  authenticated: boolean
  settingsLoaded: boolean
  dataLoaded: boolean
  serverOffline: boolean
  semesterCount: number
  progress: OnboardingProgress
}) {
  return (
    authenticated &&
    settingsLoaded &&
    dataLoaded &&
    !serverOffline &&
    semesterCount === 0 &&
    progress.coreStatus === "not_started"
  )
}

export function isFirstCriterionConfigured(
  criterion: Criterion | undefined,
  scoreEntered: boolean,
) {
  return Boolean(
    criterion &&
      criterion.name.trim().length > 0 &&
      criterion.weight > 0 &&
      scoreEntered,
  )
}
