import assert from "node:assert/strict";
import test from "node:test";

import { adjustGradeBoundary } from "../lib/grade-scale";

test("grade boundary preview clamps between adjacent cutoffs", () => {
  const scale = [
    { letter: "A", min: 90 },
    { letter: "B", min: 80 },
    { letter: "F", min: 0 },
  ];

  assert.deepEqual(adjustGradeBoundary(scale, 1, 99), [
    { letter: "A", min: 90 },
    { letter: "B", min: 89 },
    { letter: "F", min: 0 },
  ]);
  assert.deepEqual(adjustGradeBoundary(scale, 1, -5), [
    { letter: "A", min: 90 },
    { letter: "B", min: 1 },
    { letter: "F", min: 0 },
  ]);
  assert.deepEqual(scale, [
    { letter: "A", min: 90 },
    { letter: "B", min: 80 },
    { letter: "F", min: 0 },
  ]);
});
