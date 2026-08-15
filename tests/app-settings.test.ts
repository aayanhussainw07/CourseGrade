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

  assert.deepEqual(normalized.defaultGradeScale, letterScale);
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
  });

  assert.deepEqual(grading.gradeScale, [
    { letter: "S", min: 67 },
    { letter: "U", min: 0 },
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
      { letter: "P", min: 100 },
      { letter: "NO", min: 0 },
    ],
  );
});
