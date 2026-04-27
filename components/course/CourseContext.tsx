"use client";

import { createContext, useContext } from "react";
import type React from "react";
import type { Criterion, SubItem, GradeScale } from "@/lib/types";

export interface CourseContextValue {
  gradeScale: GradeScale[];
  whatIfMode: boolean;
  whatIfScores: Record<string, string>;
  expandedCriteria: Set<string>;
  draggingCriterionId: string | null;
  subDropTargetId: string | null;
  draggingSubItemId: string | null;
  setWhatIfScores: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  updateCriterion: (id: string, updates: Partial<Criterion>) => void;
  deleteCriterion: (id: string) => void;
  duplicateCriterion: (id: string) => void;
  toggleExpanded: (criterionKey: string) => void;
  addSubItem: (criterionId: string) => void;
  updateSubItem: (criterionId: string, subItemId: string, updates: Partial<SubItem>) => void;
  deleteSubItem: (criterionId: string, subItemId: string) => void;
  duplicateSubItem: (criterionId: string, subItemId: string) => void;
  handleDragStart: (e: React.DragEvent<HTMLDivElement>, criterionId: string) => void;
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDragEnter: (e: React.DragEvent<HTMLDivElement>, criterionId: string) => void;
  handleDragLeave: (e: React.DragEvent<HTMLDivElement>, criterionId: string) => void;
  handleDropOnCriterion: (e: React.DragEvent<HTMLDivElement>, criterionId: string) => void;
  handleDragEnd: () => void;
  handleSubItemDragStart: (e: React.DragEvent<HTMLDivElement>, criterionId: string, subItemId: string) => void;
  handleSubItemDropOnSibling: (e: React.DragEvent<HTMLDivElement>, criterionId: string, targetSubItemId: string) => void;
  handleSubItemDragEnd: () => void;
}

const CourseContext = createContext<CourseContextValue | null>(null);

export function useCourseContext(): CourseContextValue {
  const ctx = useContext(CourseContext);
  if (!ctx) throw new Error("useCourseContext must be used within CourseCard");
  return ctx;
}

export { CourseContext };
