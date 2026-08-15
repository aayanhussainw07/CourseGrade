"use client";

import { createContext, useContext } from "react";
import type React from "react";
import type { Criterion, SubItem, GradeScale } from "@/lib/types";

export interface DropIndicator {
  targetId: string;
  position: "before" | "after";
}

export interface PointerDragSource {
  criterionId: string;
  subItemId?: string;
}

export interface CourseContextValue {
  gradeScale: GradeScale[];
  expandedCriteria: Set<string>;
  criterionIds: string[];
  draggingCriterionId: string | null;
  draggingSubItemId: string | null;
  dropIndicator: DropIndicator | null;
  updateCriterion: (id: string, updates: Partial<Criterion>) => void;
  deleteCriterion: (id: string) => void;
  toggleExpanded: (criterionKey: string) => void;
  addSubItem: (criterionId: string) => void;
  updateSubItem: (criterionId: string, subItemId: string, updates: Partial<SubItem>) => void;
  deleteSubItem: (criterionId: string, subItemId: string) => void;
  handleDragStart: (e: React.DragEvent<HTMLDivElement>, criterionId: string) => void;
  handleDragOver: (e: React.DragEvent<HTMLDivElement>, criterionId: string) => void;
  handleDragLeave: (e: React.DragEvent<HTMLDivElement>, targetId: string) => void;
  handleDropOnCriterion: (e: React.DragEvent<HTMLDivElement>, criterionId: string) => void;
  handleDragEnd: () => void;
  handleSubItemDragStart: (e: React.DragEvent<HTMLDivElement>, criterionId: string, subItemId: string) => void;
  handleSubItemDragOver: (e: React.DragEvent<HTMLDivElement>, criterionId: string, subItemId: string) => void;
  handleSubItemDragLeave: (e: React.DragEvent<HTMLDivElement>, criterionId: string, subItemId: string) => void;
  handleSubItemDrop: (e: React.DragEvent<HTMLDivElement>, criterionId: string, targetSubItemId: string) => void;
  handleSubItemDragEnd: () => void;
  handlePointerDragStart: (source: PointerDragSource) => void;
  handlePointerDragMove: (clientX: number, clientY: number) => void;
  handlePointerDragEnd: () => void;
  handlePointerDragCancel: () => void;
}

const CourseContext = createContext<CourseContextValue | null>(null);

export function useCourseContext(): CourseContextValue {
  const ctx = useContext(CourseContext);
  if (!ctx) throw new Error("useCourseContext must be used within CourseCard");
  return ctx;
}

export { CourseContext };
