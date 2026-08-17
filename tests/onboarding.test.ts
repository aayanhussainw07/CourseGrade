import assert from "node:assert/strict"
import test from "node:test"

import {
  DEFAULT_ONBOARDING_PROGRESS,
  isAutomaticOnboardingEligible,
  isFirstCriterionConfigured,
  normalizeOnboardingProgress,
  ONBOARDING_VERSION,
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
  assert.equal(normalized.coreStep, "welcome")
  assert.equal("advancedStatus" in normalized, false)
  assert.equal("advancedStep" in normalized, false)
  assert.equal(normalized.criterionScoreEntered, true)
  assert.equal(normalized.coreSetupRequired, false)
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
