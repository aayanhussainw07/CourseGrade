import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGradeDistribution,
  buildCriterionAdditionUpdate,
  calculateGPA,
  calculateCourseGrade,
  normalizeGradeScaleMetadata,
} from "../lib/grade-utils";
import type { Course, Criterion } from "../lib/types";

const newCriterion: Criterion = {
  id: "new-criterion",
  name: "",
  weight: 0,
  score: 0,
  dropLowest: 0,
  extraCredit: 0,
};

test("adding the first criterion clears a direct grade instead of making it a bonus", () => {
  const update = buildCriterionAdditionUpdate([], newCriterion, 96);

  assert.equal(update.percentBoost, 0);
  assert.deepEqual(update.criteria, [newCriterion]);
  assert.equal(calculateCourseGrade(update.criteria, update.percentBoost), 0);
});

test("adding a later criterion preserves an existing course bonus", () => {
  const existingCriterion: Criterion = {
    id: "existing-criterion",
    name: "Exams",
    weight: 100,
    score: 90,
  };
  const existingCriteria = [existingCriterion];

  const update = buildCriterionAdditionUpdate(
    existingCriteria,
    newCriterion,
    4,
  );

  assert.equal(update.percentBoost, 4);
  assert.deepEqual(update.criteria, [existingCriterion, newCriterion]);
  assert.deepEqual(existingCriteria, [existingCriterion]);
});

test("custom grade rows drive GPA and distribution color", () => {
  const course: Course = {
    id: "custom",
    name: "Studio",
    credits: 2,
    criteria: [{ id: "work", name: "Work", weight: 100, score: 92 }],
    gradeScale: [
      { letter: "HONORS", min: 90, gpa: 7.25, color: "#123456" },
      { letter: "PASS", min: 0, gpa: 1, color: "#abcdef" },
    ],
  };

  assert.equal(calculateGPA([course]), 7.25);
  assert.deepEqual(buildGradeDistribution([course]), [
    { letter: "HONORS", count: 1, color: "#123456", gpa: 7.25, pct: 100 },
  ]);
});

test("legacy custom rows remain excluded until assigned a GPA", () => {
  const scale = normalizeGradeScaleMetadata([
    { letter: "E", min: 60 },
    { letter: "F", min: 0 },
  ]);
  assert.deepEqual(scale, [
    { letter: "E", min: 60 },
    { letter: "F", min: 0, gpa: 0, color: "#8a8a8a" },
  ]);

  const course: Course = {
    id: "legacy",
    name: "Legacy",
    credits: 3,
    criteria: [{ id: "work", name: "Work", weight: 100, score: 80 }],
    gradeScale: scale,
  };
  assert.equal(calculateGPA([course]), 0);
});
