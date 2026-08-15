import type { GradeScale } from "./types";

const clampPercentage = (value: number) => Math.min(100, Math.max(0, value));

export function adjustGradeBoundary(
  gradeScale: GradeScale[],
  index: number,
  requestedMin: number,
): GradeScale[] {
  if (!gradeScale[index]) return gradeScale;
  const order = gradeScale
    .map((grade, originalIndex) => ({ grade, originalIndex }))
    .sort((a, b) => a.grade.min - b.grade.min);
  const position = order.findIndex((item) => item.originalIndex === index);
  if (position < 0) return gradeScale;

  const lower = position > 0 ? order[position - 1].grade.min + 1 : 0;
  const upper =
    position < order.length - 1 ? order[position + 1].grade.min - 1 : 100;
  const min = Math.min(
    upper,
    Math.max(lower, clampPercentage(Math.round(requestedMin))),
  );
  return gradeScale.map((grade, originalIndex) =>
    originalIndex === index ? { ...grade, min } : grade,
  );
}
