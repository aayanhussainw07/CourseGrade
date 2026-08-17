import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAppSettings } from "../lib/app-settings";
import {
  buildDefaultCourseGrading,
  buildPassFailScale,
} from "../lib/grade-utils";
import { DEFAULT_GRADE_SCALE } from "../lib/types";

test("course open state defaults to collapsed and preserves an expand preference", () => {
  assert.equal(
    normalizeAppSettings(undefined).collapseCoursesOnSemesterOpen,
    true,
  );
  assert.equal(
    normalizeAppSettings({ collapseCoursesOnSemesterOpen: false })
      .collapseCoursesOnSemesterOpen,
    false,
  );
  assert.equal(
    normalizeAppSettings({ collapseCoursesOnSemesterOpen: "invalid" })
      .collapseCoursesOnSemesterOpen,
    true,
  );
});

test("legacy A+ GPA settings migrate into the grade row", () => {
  const normalized = normalizeAppSettings({ aPlusGpaValue: 4 });
  assert.equal(normalized.defaultGradeScale[0].gpa, 4);
  assert.equal("aPlusGpaValue" in normalized, false);
});

test("onboarding state is normalized with app settings", () => {
  const defaults = normalizeAppSettings(undefined).onboarding;
  assert.equal(defaults.coreStatus, "not_started");
  assert.equal(defaults.coreStep, "settings_credits");

  const saved = normalizeAppSettings({
    onboarding: {
      ...defaults,
      coreStatus: "in_progress",
      coreStep: "configure_criterion",
      semesterId: "12",
      courseId: "44",
      criterionScoreEntered: true,
    },
  }).onboarding;
  assert.equal(saved.coreStatus, "in_progress");
  assert.equal(saved.coreStep, "configure_criterion");
  assert.equal(saved.semesterId, "12");
  assert.equal(saved.courseId, "44");
  assert.equal(saved.criterionScoreEntered, true);
});

test("legacy pass/fail app settings restore the saved letter scale", () => {
  const letterScale = [
    { letter: "A", min: 90 },
    { letter: "F", min: 0 },
  ];
  const normalized = normalizeAppSettings({
    defaultIsPassFail: true,
    defaultPassLabel: "P",
    defaultFailLabel: "F",
    defaultPassThreshold: 65,
    defaultGradeScale: [
      { letter: "P", min: 65 },
      { letter: "F", min: 0 },
    ],
    defaultGradeScaleSnapshot: letterScale,
  });

  assert.deepEqual(normalized.defaultGradeScale, [
    { letter: "A", min: 90, gpa: 4, color: "#d9645a" },
    { letter: "F", min: 0, gpa: 0, color: "#8a8a8a" },
  ]);
  assert.equal("defaultGradeScaleSnapshot" in normalized, false);
  assert.equal(normalized.defaultIsPassFail, true);
});

test("legacy pass/fail settings without a snapshot recover the standard letter scale", () => {
  const normalized = normalizeAppSettings({
    defaultIsPassFail: true,
    defaultPassLabel: "PASS",
    defaultFailLabel: "NO PASS",
    defaultPassThreshold: 70,
    defaultGradeScale: [
      { letter: "PASS", min: 70 },
      { letter: "NO PASS", min: 0 },
    ],
  });

  assert.deepEqual(normalized.defaultGradeScale, DEFAULT_GRADE_SCALE);
});

test("new pass/fail courses retain an independent letter-scale snapshot", () => {
  const letterScale = [
    { letter: "A", min: 92 },
    { letter: "F", min: 0 },
  ];
  const grading = buildDefaultCourseGrading({
    defaultGradeScale: letterScale,
    defaultIsPassFail: true,
    defaultPassLabel: "S",
    defaultFailLabel: "U",
    defaultPassThreshold: 67,
    defaultPassColor: "#123456",
    defaultFailColor: "#654321",
  });

  assert.deepEqual(grading.gradeScale, [
    { letter: "S", min: 67, color: "#123456" },
    { letter: "U", min: 0, color: "#654321" },
  ]);
  assert.deepEqual(grading.gradeScaleSnapshot, letterScale);
  assert.notEqual(grading.gradeScaleSnapshot, letterScale);
});

test("pass/fail scale labels and threshold are sanitized", () => {
  assert.deepEqual(
    buildPassFailScale({
      passLabel: "  ",
      failLabel: " NO ",
      threshold: 130,
    }),
    [
      { letter: "P", min: 100, color: "#888888" },
      { letter: "NO", min: 0, color: "#8a8a8a" },
    ],
  );
});
