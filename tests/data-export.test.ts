import assert from "node:assert/strict";
import test from "node:test";
import { serializeAllGradesCsv } from "../lib/data-export";
import { parseCourseCsv, serializeCourseCsv } from "../lib/csv";
import type { Course, Semester } from "../lib/types";

const gradeScale = [
  { letter: "A", min: 90 },
  { letter: "B", min: 80 },
  { letter: "F", min: 0 },
];

const course = (overrides: Partial<Course> = {}): Course => ({
  id: "course-1",
  name: "Algorithms",
  credits: 3,
  criteria: [],
  gradeScale,
  ...overrides,
});

const semester = (overrides: Partial<Semester> = {}): Semester => ({
  id: "semester-1",
  name: "Fall 2026",
  courses: [],
  ...overrides,
});

test("exports semesters, courses, criteria, and calculated grades in order", () => {
  const csv = serializeAllGradesCsv([
    semester({
      courses: [
        course({
          criteria: [
            { id: "exams", name: "Exams", weight: 40, score: 80 },
            { id: "projects", name: "Projects", weight: 60, score: 100 },
          ],
        }),
      ],
    }),
    semester({ id: "semester-2", name: "Spring 2027" }),
  ]);

  assert.equal(
    csv,
    [
      "Semester,Course,Criterion,Weight (%),Criterion Grade (%),Course Grade (%),Course Grade",
      "Fall 2026,Algorithms,Exams,40,80,92,A",
      "Fall 2026,Algorithms,Projects,60,100,92,A",
      "",
      "Spring 2027,,,,,,",
      "",
    ].join("\r\n"),
  );
});

test("aggregates sub-items and uses pass/fail course labels", () => {
  const csv = serializeAllGradesCsv([
    semester({
      courses: [
        course({
          isPassFail: true,
          passLabel: "Complete",
          failLabel: "Incomplete",
          passThreshold: 85,
          criteria: [
            {
              id: "labs",
              name: "Labs",
              weight: 100,
              score: 0,
              subItems: [
                { id: "lab-1", name: "Lab 1", score: 80 },
                { id: "lab-2", name: "Lab 2", score: 100 },
              ],
            },
          ],
        }),
      ],
    }),
  ]);

  assert.match(csv, /Fall 2026,Algorithms,Labs,100,90,90,Complete/);
});

test("escapes commas, quotes, and line breaks and includes empty courses", () => {
  const csv = serializeAllGradesCsv([
    semester({
      name: 'Fall, "Honors"',
      courses: [
        course({ name: "Writing\nSeminar" }),
      ],
    }),
  ]);

  assert.match(
    csv,
    /"Fall, ""Honors""","Writing\nSeminar",,,,0,F/,
  );
});

test("portable course exports preserve grade metadata and pass/fail snapshots", () => {
  const exported = parseCourseCsv(serializeCourseCsv(course({
    isPassFail: true,
    passColor: "#112233",
    failColor: "#445566",
    gradeScale: [
      { letter: "S", min: 70, color: "#112233" },
      { letter: "U", min: 0, color: "#445566" },
    ],
    gradeScaleSnapshot: [
      { letter: "H", min: 90, gpa: 6.5, color: "#abcdef" },
      { letter: "F", min: 0, gpa: 0, color: "#101010" },
    ],
  })));

  assert.equal(exported.passColor, "#112233");
  assert.equal(exported.failColor, "#445566");
  assert.deepEqual(exported.gradeScaleSnapshot, [
    { letter: "H", min: 90, gpa: 6.5, color: "#abcdef" },
    { letter: "F", min: 0, gpa: 0, color: "#101010" },
  ]);
});
