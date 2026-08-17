import assert from "node:assert/strict";
import test from "node:test";

import { apiToFrontendCourse } from "../lib/types";

test("cloud course payload restores pass/fail labels, letter snapshot, and criterion extras", () => {
  const course = apiToFrontendCourse({
    id: 7,
    semester: 2,
    name: "Studio",
    credits: 2,
    is_pass_fail: true,
    pass_label: "S",
    fail_label: "U",
    pass_threshold: 70,
    pass_color: "#112233",
    fail_color: "#445566",
    letter_grade_scale: [
      { letter: "A", min: 90, gpa: 6, color: "#abcdef" },
      { letter: "F", min: 0, gpa: 0, color: "#101010" },
    ],
    assignments: [
      {
        id: 14,
        course: 7,
        client_id: "criterion-stable-id",
        name: "Projects",
        weight: 100,
        earned: 85,
        total: 100,
        extra_credit: 3,
        sub_items: [{ id: "project-1", name: "Project 1", score: 85 }],
        created_at: "2026-08-15T00:00:00Z",
        updated_at: "2026-08-15T00:00:00Z",
      },
    ],
    created_at: "2026-08-15T00:00:00Z",
    updated_at: "2026-08-15T00:00:00Z",
  });

  assert.deepEqual(course.gradeScale, [
    { letter: "S", min: 70, color: "#112233" },
    { letter: "U", min: 0, color: "#445566" },
  ]);
  assert.deepEqual(course.gradeScaleSnapshot, [
    { letter: "A", min: 90, gpa: 6, color: "#abcdef" },
    { letter: "F", min: 0, gpa: 0, color: "#101010" },
  ]);
  assert.equal(course.passColor, "#112233");
  assert.equal(course.failColor, "#445566");
  assert.equal(course.criteria[0].clientId, "criterion-stable-id");
  assert.equal(course.criteria[0].extraCredit, 3);
  assert.deepEqual(course.criteria[0].subItems, [
    { id: "project-1", name: "Project 1", score: 85 },
  ]);
});
