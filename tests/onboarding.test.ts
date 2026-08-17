import assert from "node:assert/strict"
import test from "node:test"

import {
  DEFAULT_ONBOARDING_PROGRESS,
  getNextSettingsOnboardingStep,
  getNextUiOnboardingStep,
  getPreviousSettingsOnboardingStep,
  getPreviousUiOnboardingStep,
  isAutomaticOnboardingEligible,
  isFirstCriterionConfigured,
  isSettingsOnboardingStep,
  isUiOnboardingStep,
  normalizeOnboardingProgress,
  ONBOARDING_VERSION,
  SETTINGS_ONBOARDING_STEPS,
  UI_ONBOARDING_STEPS,
} from "../lib/onboarding"

test("onboarding progress rejects malformed and outdated state", () => {
  assert.deepEqual(
    normalizeOnboardingProgress({ version: ONBOARDING_VERSION - 1 }),
    DEFAULT_ONBOARDING_PROGRESS,
  )

  const normalized = normalizeOnboardingProgress({
    version: ONBOARDING_VERSION,
    coreStatus: "not-real",
    coreStep: "missing",
    advancedStatus: "completed",
    advancedStep: "dashboard",
    criterionScoreEntered: true,
    coreSetupRequired: false,
  })

  assert.equal(normalized.coreStatus, "not_started")
  assert.equal(normalized.coreStep, "settings_credits")
  assert.equal("advancedStatus" in normalized, false)
  assert.equal("advancedStep" in normalized, false)
  assert.equal(normalized.criterionScoreEntered, true)
  assert.equal(normalized.coreSetupRequired, false)
})

test("settings onboarding precedes the existing UI walkthrough", () => {
  assert.deepEqual(SETTINGS_ONBOARDING_STEPS, [
    "settings_credits",
    "settings_grade_scale",
    "settings_course_behavior",
  ])
  assert.equal(UI_ONBOARDING_STEPS[0], "welcome")
  assert.equal(isSettingsOnboardingStep("settings_grade_scale"), true)
  assert.equal(isSettingsOnboardingStep("welcome"), false)
  assert.equal(isUiOnboardingStep("welcome"), true)
  assert.equal(isUiOnboardingStep("settings_course_behavior"), false)
  assert.equal(
    getNextSettingsOnboardingStep("settings_credits"),
    "settings_grade_scale",
  )
  assert.equal(
    getNextSettingsOnboardingStep("settings_course_behavior"),
    undefined,
  )
  assert.equal(
    getPreviousSettingsOnboardingStep("settings_course_behavior"),
    "settings_grade_scale",
  )
  assert.equal(
    getPreviousSettingsOnboardingStep("settings_credits"),
    undefined,
  )

  const savedSettingsStep = normalizeOnboardingProgress({
    ...DEFAULT_ONBOARDING_PROGRESS,
    version: ONBOARDING_VERSION,
    coreStatus: "in_progress",
    coreStep: "settings_a_plus",
  })
  assert.equal(savedSettingsStep.coreStep, "settings_course_behavior")
  assert.equal(savedSettingsStep.coreStatus, "in_progress")
})

test("UI onboarding navigation includes every page for setup and replay", () => {
  assert.equal(getPreviousUiOnboardingStep("welcome"), undefined)
  assert.equal(getNextUiOnboardingStep("welcome"), "add_semester")
  assert.equal(
    getPreviousUiOnboardingStep("rename_semester"),
    "add_semester",
  )
  assert.equal(
    getNextUiOnboardingStep("dashboard_finish"),
    undefined,
  )

  assert.equal(getNextUiOnboardingStep("welcome"), "add_semester")
  assert.equal(
    getNextUiOnboardingStep("add_semester"),
    "rename_semester",
  )
  assert.equal(
    getPreviousUiOnboardingStep("configure_criterion"),
    "add_criterion",
  )
})

test("automatic onboarding only starts for a ready empty account", () => {
  const ready = {
    authenticated: true,
    settingsLoaded: true,
    dataLoaded: true,
    serverOffline: false,
    semesterCount: 0,
    progress: DEFAULT_ONBOARDING_PROGRESS,
  }

  assert.equal(isAutomaticOnboardingEligible(ready), true)
  assert.equal(
    isAutomaticOnboardingEligible({ ...ready, semesterCount: 1 }),
    false,
  )
  assert.equal(
    isAutomaticOnboardingEligible({ ...ready, settingsLoaded: false }),
    false,
  )
  assert.equal(
    isAutomaticOnboardingEligible({
      ...ready,
      progress: { ...ready.progress, coreStatus: "dismissed" },
    }),
    false,
  )
  assert.equal(
    isAutomaticOnboardingEligible({
      ...ready,
      progress: { ...ready.progress, coreStatus: "completed" },
    }),
    false,
  )
})

test("an explicitly committed zero is a valid criterion score", () => {
  const criterion = {
    id: "criterion-1",
    name: "Assignments",
    weight: 40,
    score: 0,
  }

  assert.equal(isFirstCriterionConfigured(criterion, false), false)
  assert.equal(isFirstCriterionConfigured(criterion, true), true)
  assert.equal(
    isFirstCriterionConfigured({ ...criterion, weight: 0 }, true),
    false,
  )
})
