import type { Criterion } from "./types"

export const ONBOARDING_VERSION = 1

export type OnboardingStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "dismissed"

export const SETTINGS_ONBOARDING_STEPS = [
  "settings_credits",
  "settings_grade_scale",
  "settings_course_behavior",
] as const

export const UI_ONBOARDING_STEPS = [
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
] as const

export type SettingsOnboardingStep =
  (typeof SETTINGS_ONBOARDING_STEPS)[number]
export type UiOnboardingStep = (typeof UI_ONBOARDING_STEPS)[number]
export type CoreOnboardingStep = SettingsOnboardingStep | UiOnboardingStep

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
  coreStep: "settings_credits",
  criterionScoreEntered: false,
  coreSetupRequired: true,
}

const SETTINGS_STEP_SET = new Set<CoreOnboardingStep>(
  SETTINGS_ONBOARDING_STEPS,
)
const UI_STEP_SET = new Set<CoreOnboardingStep>(UI_ONBOARDING_STEPS)
const CORE_STEPS = new Set<CoreOnboardingStep>([
  ...SETTINGS_ONBOARDING_STEPS,
  ...UI_ONBOARDING_STEPS,
])

const STATUSES = new Set<OnboardingStatus>([
  "not_started",
  "in_progress",
  "completed",
  "dismissed",
])

const optionalString = (value: unknown) =>
  typeof value === "string" && value.length > 0 ? value : undefined

export function isSettingsOnboardingStep(
  step: CoreOnboardingStep,
): step is SettingsOnboardingStep {
  return SETTINGS_STEP_SET.has(step)
}

export function isUiOnboardingStep(
  step: CoreOnboardingStep,
): step is UiOnboardingStep {
  return UI_STEP_SET.has(step)
}

export function getNextSettingsOnboardingStep(
  step: SettingsOnboardingStep,
): SettingsOnboardingStep | undefined {
  const index = SETTINGS_ONBOARDING_STEPS.indexOf(step)
  return SETTINGS_ONBOARDING_STEPS[index + 1]
}

export function getPreviousSettingsOnboardingStep(
  step: SettingsOnboardingStep,
): SettingsOnboardingStep | undefined {
  const index = SETTINGS_ONBOARDING_STEPS.indexOf(step)
  return SETTINGS_ONBOARDING_STEPS[index - 1]
}

export function getPreviousUiOnboardingStep(
  step: UiOnboardingStep,
): UiOnboardingStep | undefined {
  const index = UI_ONBOARDING_STEPS.indexOf(step)
  return index > 0 ? UI_ONBOARDING_STEPS[index - 1] : undefined
}

export function getNextUiOnboardingStep(
  step: UiOnboardingStep,
): UiOnboardingStep | undefined {
  const index = UI_ONBOARDING_STEPS.indexOf(step)
  return index >= 0 ? UI_ONBOARDING_STEPS[index + 1] : undefined
}

export function normalizeOnboardingProgress(value: unknown): OnboardingProgress {
  if (typeof value !== "object" || value === null) {
    return { ...DEFAULT_ONBOARDING_PROGRESS }
  }

  const stored = value as Partial<OnboardingProgress>
  if (stored.version !== ONBOARDING_VERSION) {
    return { ...DEFAULT_ONBOARDING_PROGRESS }
  }

  const coreStep = (stored.coreStep as string) === "settings_a_plus"
    ? "settings_course_behavior"
    : CORE_STEPS.has(stored.coreStep as CoreOnboardingStep)
      ? (stored.coreStep as CoreOnboardingStep)
      : DEFAULT_ONBOARDING_PROGRESS.coreStep

  return {
    version: ONBOARDING_VERSION,
    coreStatus: STATUSES.has(stored.coreStatus as OnboardingStatus)
      ? (stored.coreStatus as OnboardingStatus)
      : "not_started",
    coreStep,
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
