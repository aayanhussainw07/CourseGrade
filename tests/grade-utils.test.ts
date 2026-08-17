import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCriterionAdditionUpdate,
  calculateCourseGrade,
} from "../lib/grade-utils";
import type { Criterion } from "../lib/types";

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
