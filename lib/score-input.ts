import type { GradeScale } from "./types";

export const parseDraftNumber = (value: string): number | null => {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
};

const fractionToPercentage = (value: string): number | null => {
  const fractionMatch = value
    .trim()
    .match(/^([+-]?\d*\.?\d+)\s*\/\s*([+-]?\d*\.?\d+)$/);
  if (!fractionMatch) return null;
  const numerator = Number.parseFloat(fractionMatch[1]);
  const denominator = Number.parseFloat(fractionMatch[2]);
  if (Number.isNaN(numerator) || Number.isNaN(denominator) || denominator === 0)
    return null;
  return (numerator / denominator) * 100;
};

const letterToPercentage = (input: string, gradeScale: GradeScale[]): number | null => {
  if (!input) return null;
  const normalized = input.trim().toUpperCase();
  if (!normalized) return null;
  const match = gradeScale.find(
    (grade) => grade.letter.trim().toUpperCase() === normalized,
  );
  return match ? match.min : null;
};

export const parseScoreInput = (value: string, gradeScale: GradeScale[]): number | null => {
  if (!value.trim()) return null;
  const fractionResult = fractionToPercentage(value);
  if (fractionResult !== null) return fractionResult;
  const letterResult = letterToPercentage(value, gradeScale);
  if (letterResult !== null) return letterResult;
  return parseDraftNumber(value);
};

export const parseFractionOrNumber = (value: string): number | null => {
  if (!value.trim()) return null;
  const fractionResult = fractionToPercentage(value);
  if (fractionResult !== null) return fractionResult;
  return parseDraftNumber(value);
};

export const formatNumberValue = (value: number | null | undefined): string => {
  if (value === undefined || value === null || Number.isNaN(value) || value === 0)
    return "";
  return value.toString();
};
