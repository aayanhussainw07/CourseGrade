"use client";

import type React from "react";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Trash2,
  Plus,
  X,
  Settings,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Palette,
  Download,
  GripVertical,
  Copy,
  FlaskConical,
  Pencil,
} from "lucide-react";
import {
  calculateCourseGrade,
  cloneGradeScale,
  getLetterGrade,
  getLetterGradeColor,
  getMonochromeCardColor,
} from "@/lib/grade-utils";
import type { Course, Criterion, SubItem, GradeScale } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { GradeScaleEditor } from "@/components/grade-scale-editor";
import { RollingNumber } from "@/components/rolling-number";
import { DEFAULT_GRADE_SCALE } from "@/lib/types";

const buildPassFailScale = (settings: {
  passLabel?: string;
  failLabel?: string;
  threshold?: number;
}): GradeScale[] => {
  const passLabel = settings.passLabel?.trim() || "P";
  const failLabel = settings.failLabel?.trim() || "F";
  const rawThreshold =
    typeof settings.threshold === "number" ? settings.threshold : 60;
  const threshold = Math.min(100, Math.max(0, rawThreshold));
  return [
    { letter: passLabel, min: threshold },
    { letter: failLabel, min: 0 },
  ];
};

const courseColorOptions = [
  { id: "default", label: "Default", color: "" },
  { id: "frost", label: "Frost", color: "rgba(255, 255, 255, 0.1)" },
  { id: "smoke", label: "Smoke", color: "rgba(255, 255, 255, 0.08)" },
  { id: "pewter", label: "Pewter", color: "rgba(235, 235, 235, 0.06)" },
  { id: "graphite", label: "Graphite", color: "rgba(170, 170, 170, 0.12)" },
  { id: "charcoal", label: "Charcoal", color: "rgba(120, 120, 120, 0.14)" },
  { id: "ash", label: "Ash", color: "rgba(90, 90, 90, 0.15)" },
  { id: "slate", label: "Slate", color: "rgba(70, 70, 70, 0.16)" },
  { id: "steel", label: "Steel", color: "rgba(50, 50, 50, 0.18)" },
  { id: "ink", label: "Ink", color: "rgba(30, 30, 30, 0.2)" },
  { id: "obsidian", label: "Obsidian", color: "rgba(12, 12, 12, 0.24)" },
];

const parseDraftNumber = (value: string) => {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
};

const letterToPercentage = (input: string, gradeScale: GradeScale[]) => {
  if (!input) return null;
  const normalized = input.trim().toUpperCase();
  if (!normalized) return null;
  const match = gradeScale.find(
    (grade) => grade.letter.trim().toUpperCase() === normalized,
  );
  return match ? match.min : null;
};

const fractionToPercentage = (value: string) => {
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

const parseScoreInput = (value: string, gradeScale: GradeScale[]) => {
  if (!value.trim()) return null;
  const fractionResult = fractionToPercentage(value);
  if (fractionResult !== null) return fractionResult;

  const letterResult = letterToPercentage(value, gradeScale);
  if (letterResult !== null) return letterResult;

  return parseDraftNumber(value);
};

const parseFractionOrNumber = (value: string) => {
  if (!value.trim()) return null;
  const fractionResult = fractionToPercentage(value);
  if (fractionResult !== null) return fractionResult;
  return parseDraftNumber(value);
};

// Props passed into this component: a single course object and functions to update or delete it.
interface CourseCardProps {
  course: Course;
  highlighted?: boolean;
  onUpdate: (id: string, course: Course) => void | Promise<void>;
  onDelete: (id: string) => void;
  onExportCourse?: (courseId: string) => void;
  onDuplicate?: () => void;
}

// The CourseCard component — displays one course, lets you edit criteria, grade scale, etc.
export function CourseCard({
  course,
  highlighted = false,
  onUpdate,
  onDelete,
  onExportCourse,
  onDuplicate,
}: CourseCardProps) {
  // State for whether the grade scale editor dialog is open
  const [isScaleOpen, setIsScaleOpen] = useState(false);
  // State for which criteria are expanded (for showing sub-items like individual assignments)
  const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(
    new Set(),
  );
  const [nameDraft, setNameDraft] = useState(course.name);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement | null>(null);
  const formatCreditsDraft = (value: number | null | undefined) => {
    if (value === undefined || value === null || value === 0) return "";
    return value.toString();
  };

  const [creditsDraft, setCreditsDraft] = useState(() =>
    formatCreditsDraft(course.credits),
  );
  const [creditsFocused, setCreditsFocused] = useState(false);
  const formatPercentBoostDraft = (value: number | null | undefined) => {
    if (value === undefined || value === null || value === 0) return "";
    return value.toString();
  };
  const [percentBoostDraft, setPercentBoostDraft] = useState(() =>
    formatPercentBoostDraft(course.percentBoost),
  );
  const [percentBoostFocused, setPercentBoostFocused] = useState(false);
  type CriterionNumericField =
    | "weight"
    | "score"
    | "dropLowest"
    | "extraCredit";
  const [criterionDrafts, setCriterionDrafts] = useState<
    Record<string, Partial<Record<CriterionNumericField, string>>>
  >({});
  const [criterionNameDrafts, setCriterionNameDrafts] = useState<
    Record<string, string>
  >({});
  const [subItemDrafts, setSubItemDrafts] = useState<Record<string, string>>(
    {},
  );
  const [draggingCriterionId, setDraggingCriterionId] = useState<string | null>(
    null,
  );
  const [subDropTargetId, setSubDropTargetId] = useState<string | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  const [draggingSubItemId, setDraggingSubItemId] = useState<string | null>(
    null,
  );
  const [draggingSubItemParentId, setDraggingSubItemParentId] = useState<
    string | null
  >(null);
  const [subItemWeightDrafts, setSubItemWeightDrafts] = useState<
    Record<string, string>
  >({});
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragOverIdRef = useRef<string | null>(null);
  const [whatIfMode, setWhatIfMode] = useState(false);
  const [whatIfScores, setWhatIfScores] = useState<Record<string, string>>({});
  const [directGradeEditing, setDirectGradeEditing] = useState(false);
  const [directGradeDraft, setDirectGradeDraft] = useState("");
  const interactiveDragSelector =
    "button, input, textarea, select, a[href], [contenteditable='true'], [role='button'], [draggable='false']";

  // Clear stale drafts when criteria are updated externally (e.g. by the AI)
  const prevCriteriaRef = useRef(course.criteria);
  useEffect(() => {
    const prev = prevCriteriaRef.current;
    prevCriteriaRef.current = course.criteria;
    if (prev === course.criteria) return;

    const changedIds = new Set<string>();
    for (const cr of course.criteria) {
      const p = prev.find((x) => x.id === cr.id);
      if (!p || p.score !== cr.score || p.weight !== cr.weight || p.name !== cr.name || p.extraCredit !== cr.extraCredit || p.dropLowest !== cr.dropLowest) {
        changedIds.add(cr.id);
      }
    }
    if (changedIds.size === 0) return;

    setCriterionDrafts((d) => {
      const next = { ...d };
      for (const id of changedIds) delete next[id];
      return next;
    });
    setCriterionNameDrafts((d) => {
      const next = { ...d };
      for (const id of changedIds) delete next[id];
      return next;
    });
    setSubItemDrafts((d) => {
      const next = { ...d };
      for (const cr of course.criteria) {
        if (changedIds.has(cr.id)) {
          for (const si of cr.subItems ?? []) delete next[si.id];
        }
      }
      return next;
    });
    setSubItemWeightDrafts((d) => {
      const next = { ...d };
      for (const cr of course.criteria) {
        if (changedIds.has(cr.id)) {
          for (const si of cr.subItems ?? []) delete next[si.id];
        }
      }
      return next;
    });
  }, [course.criteria]);

  useEffect(() => {
    setNameDraft(course.name);
  }, [course.name]);

  useEffect(() => {
    if (creditsFocused) return;
    if ((course.credits ?? 0) === 0 && creditsDraft === "") {
      return;
    }
    setCreditsDraft(formatCreditsDraft(course.credits));
  }, [course.credits, creditsFocused, creditsDraft]);

  useEffect(() => {
    if (percentBoostFocused) return;
    if ((course.percentBoost ?? 0) === 0 && percentBoostDraft === "") {
      return;
    }
    setPercentBoostDraft(formatPercentBoostDraft(course.percentBoost));
  }, [course.percentBoost, percentBoostDraft, percentBoostFocused]);

  useEffect(() => {
    if (!colorPickerOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (
        colorPickerRef.current &&
        !colorPickerRef.current.contains(event.target as Node)
      ) {
        setColorPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [colorPickerOpen]);

  const updateCourse = useCallback(
    (updates: Partial<Course>) => {
      onUpdate(course.id, { ...course, ...updates });
    },
    [course, onUpdate],
  );

  const courseCriteria = useMemo(
    () => (Array.isArray(course.criteria) ? course.criteria : []),
    [course.criteria],
  );

  const { numericGrade, letterGrade, gradeColor, totalWeight, whatIfNumericGrade, whatIfLetterGrade, whatIfGradeColor } = useMemo(() => {
    const numeric = calculateCourseGrade(courseCriteria, course.percentBoost);
    const letter = getLetterGrade(numeric, course.gradeScale);
    const whatIfCriteria = courseCriteria.map((c) => {
      const raw = whatIfScores[c.id];
      if (raw === undefined) return c;
      const parsed = parseScoreInput(raw, course.gradeScale);
      return parsed !== null ? { ...c, score: parsed } : c;
    });
    const whatIfNumeric = calculateCourseGrade(whatIfCriteria, course.percentBoost);
    const whatIfLetter = getLetterGrade(whatIfNumeric, course.gradeScale);
    return {
      numericGrade: numeric,
      letterGrade: letter,
      gradeColor: getLetterGradeColor(letter),
      totalWeight: courseCriteria.reduce((sum, c) => sum + c.weight, 0),
      whatIfNumericGrade: whatIfNumeric,
      whatIfLetterGrade: whatIfLetter,
      whatIfGradeColor: getLetterGradeColor(whatIfLetter),
    };
  }, [courseCriteria, course.gradeScale, course.percentBoost, whatIfScores]);

  // Toggle collapse/expand for the entire course card
  const toggleCollapse = () => {
    updateCourse({ collapsed: !course.collapsed });
  };

  // Update the course name (typing in the title input)
  const updateCourseName = (name: string) => {
    if (name === course.name) return;
    updateCourse({ name });
  };
  const commitCourseName = () => updateCourseName(nameDraft);

  // Update number of credit hours
  const commitCredits = () => {
    const trimmed = creditsDraft.trim();
    if (trimmed === "") {
      if ((course.credits ?? 0) !== 0) {
        updateCourse({ credits: 0 });
      }
      setCreditsDraft("");
      return;
    }
    const parsed = Number.parseFloat(trimmed);
    if (Number.isNaN(parsed)) {
      setCreditsDraft(formatCreditsDraft(course.credits));
      return;
    }
    const normalized = Math.round(parsed);
    setCreditsDraft(normalized.toString());
    if (normalized === course.credits) {
      return;
    }
    updateCourse({ credits: normalized });
  };

  const commitPercentBoost = () => {
    const trimmed = percentBoostDraft.trim();
    if (trimmed === "") {
      if ((course.percentBoost ?? 0) !== 0) {
        updateCourse({ percentBoost: 0 });
      }
      setPercentBoostDraft("");
      return;
    }
    const parsed = Number.parseFloat(trimmed);
    if (Number.isNaN(parsed)) {
      setPercentBoostDraft(formatPercentBoostDraft(course.percentBoost));
      return;
    }
    const normalized = Math.max(
      0,
      Math.min(100, Number.parseFloat(parsed.toFixed(2))),
    );
    setPercentBoostDraft(normalized.toString());
    if (normalized === (course.percentBoost ?? 0)) {
      return;
    }
    updateCourse({ percentBoost: normalized });
  };

  const updateCardColor = (colorValue: string) => {
    const normalized = colorValue || null;
    if ((course.cardColor ?? null) === normalized) return;
    updateCourse({ cardColor: normalized });
  };

  // Add a new grading criterion (like "Assignments" or "Midterm")
  const addCriterion = () => {
    const localId = crypto.randomUUID();
    const newCriterion: Criterion = {
      id: localId,
      clientId: localId,
      name: "",
      weight: 0,
      score: 0,
      dropLowest: 0,
      extraCredit: 0,
    };
    updateCourse({
      criteria: [...courseCriteria, newCriterion],
    });
  };

  // Update a specific criterion (name, weight, or score)
  const updateCriterion = (id: string, updates: Partial<Criterion>) => {
    updateCourse({
      criteria: courseCriteria.map((c) =>
        c.id === id ? { ...c, ...updates } : c,
      ),
    });
  };

  const moveCriterion = useCallback(
    (
      sourceId: string,
      targetId: string | null,
      position: "before" | "after" = "before",
    ) => {
      if (!sourceId || sourceId === targetId) return;
      const current = Array.isArray(courseCriteria) ? courseCriteria : [];
      const working = [...current];
      const sourceIndex = working.findIndex(
        (criterion) => criterion.id === sourceId,
      );
      if (sourceIndex === -1) return;
      const [moved] = working.splice(sourceIndex, 1);
      if (!targetId) {
        if (position === "after") {
          working.push(moved);
        } else {
          working.unshift(moved);
        }
      } else {
        let targetIndex = working.findIndex(
          (criterion) => criterion.id === targetId,
        );
        if (targetIndex === -1) {
          working.push(moved);
        } else {
          if (position === "after") {
            targetIndex += 1;
          }
          working.splice(targetIndex, 0, moved);
        }
      }
      updateCourse({
        criteria: working,
      });
    },
    [courseCriteria, updateCourse],
  );

  // Delete a criterion entirely
  const deleteCriterion = (id: string) => {
    updateCourse({
      criteria: courseCriteria.filter((c) => c.id !== id),
    });
  };

  // Duplicate a criterion, inserting the copy immediately after the original
  const duplicateCriterion = (id: string) => {
    const source = courseCriteria.find((c) => c.id === id);
    if (!source) return;
    const newId = crypto.randomUUID();
    const duplicate: Criterion = {
      ...source,
      id: newId,
      clientId: newId,
      name: source.name ? `${source.name} (copy)` : "",
      subItems: source.subItems?.map((si) => ({
        ...si,
        id: crypto.randomUUID(),
      })),
    };
    const sourceIndex = courseCriteria.findIndex((c) => c.id === id);
    const updated = [...courseCriteria];
    updated.splice(sourceIndex + 1, 0, duplicate);
    updateCourse({ criteria: updated });
  };

  // Convert a criterion into a sub-item of another criterion
  const convertToSubCriterion = (sourceId: string, targetId: string) => {
    const source = courseCriteria.find((c) => c.id === sourceId);
    const target = courseCriteria.find((c) => c.id === targetId);
    if (!source || !target) return;
    const sourceScore =
      source.subItems && source.subItems.length > 0
        ? source.subItems.reduce((sum, si) => sum + si.score, 0) /
          source.subItems.length
        : source.score;
    const newSubItem: SubItem = {
      id: crypto.randomUUID(),
      name: source.name || "Item",
      score: sourceScore,
    };
    const updatedTarget: Criterion = {
      ...target,
      subItems: [...(target.subItems ?? []), newSubItem],
    };
    const targetKey = target.clientId ?? target.id;
    setExpandedCriteria((prev) => new Set(prev).add(targetKey));
    updateCourse({
      criteria: courseCriteria
        .filter((c) => c.id !== sourceId)
        .map((c) => (c.id === targetId ? updatedTarget : c)),
    });
  };

  // Add a sub-item (like "Homework 1") under a criterion
  const addSubItem = (criterionId: string) => {
    const criterion = courseCriteria.find((c) => c.id === criterionId);
    if (!criterion) return;

    const newSubItem: SubItem = {
      id: crypto.randomUUID(),
      name: "",
      score: 0,
    };

    const subItems = criterion.subItems || [];
    updateCriterion(criterionId, {
      subItems: [...subItems, newSubItem],
    });

    // Expand the criterion after adding a sub-item so it’s visible
    const expandedKey = criterion.clientId ?? criterion.id;
    setExpandedCriteria((prev) => new Set(prev).add(expandedKey));
  };

  // Update a sub-item (name or score)
  const updateSubItem = (
    criterionId: string,
    subItemId: string,
    updates: Partial<SubItem>,
  ) => {
    const criterion = courseCriteria.find((c) => c.id === criterionId);
    if (!criterion || !criterion.subItems) return;

    updateCriterion(criterionId, {
      subItems: criterion.subItems.map((item) =>
        item.id === subItemId ? { ...item, ...updates } : item,
      ),
    });
  };

  // Delete a sub-item (like removing "Homework 2")
  const deleteSubItem = (criterionId: string, subItemId: string) => {
    const criterion = courseCriteria.find((c) => c.id === criterionId);
    if (!criterion || !criterion.subItems) return;

    updateCriterion(criterionId, {
      subItems: criterion.subItems.filter((item) => item.id !== subItemId),
    });
  };

  const duplicateSubItem = (criterionId: string, subItemId: string) => {
    const criterion = courseCriteria.find((c) => c.id === criterionId);
    if (!criterion?.subItems) return;
    const source = criterion.subItems.find((si) => si.id === subItemId);
    if (!source) return;
    const newId = crypto.randomUUID();
    const dupe = {
      ...source,
      id: newId,
      name: source.name ? `${source.name} (copy)` : "",
    };
    const idx = criterion.subItems.findIndex((si) => si.id === subItemId);
    const updated = [...criterion.subItems];
    updated.splice(idx + 1, 0, dupe);
    updateCriterion(criterionId, { subItems: updated });
  };

  const moveSubItemWithinParent = (
    criterionId: string,
    sourceId: string,
    targetId: string,
    after: boolean,
  ) => {
    const criterion = courseCriteria.find((c) => c.id === criterionId);
    if (!criterion?.subItems) return;
    const items = [...criterion.subItems];
    const fromIdx = items.findIndex((si) => si.id === sourceId);
    if (fromIdx === -1) return;
    const [moved] = items.splice(fromIdx, 1);
    let toIdx = items.findIndex((si) => si.id === targetId);
    if (toIdx === -1) {
      items.push(moved);
    } else {
      if (after) toIdx += 1;
      items.splice(toIdx, 0, moved);
    }
    updateCriterion(criterionId, { subItems: items });
  };

  const promoteSubItemToCriterion = (
    parentCriterionId: string,
    subItemId: string,
    adjacentCriterionId: string | null,
    position: "before" | "after",
  ) => {
    const parent = courseCriteria.find((c) => c.id === parentCriterionId);
    if (!parent?.subItems) return;
    const subItem = parent.subItems.find((si) => si.id === subItemId);
    if (!subItem) return;
    const subItemWeight = subItem.weight ?? 100 / parent.subItems.length;
    const criterionWeight = Number(
      ((subItemWeight * parent.weight) / 100).toFixed(2),
    );
    const newId = crypto.randomUUID();
    const newCriterion: Criterion = {
      id: newId,
      clientId: newId,
      name: subItem.name || "Item",
      weight: criterionWeight,
      score: subItem.score,
      dropLowest: 0,
      extraCredit: 0,
    };
    const updatedParent: Criterion = {
      ...parent,
      subItems: parent.subItems.filter((si) => si.id !== subItemId),
    };
    let updated = courseCriteria.map((c) =>
      c.id === parentCriterionId ? updatedParent : c,
    );
    if (!adjacentCriterionId) {
      updated = [...updated, newCriterion];
    } else {
      const tIdx = updated.findIndex((c) => c.id === adjacentCriterionId);
      const insertIdx =
        tIdx === -1 ? updated.length : position === "after" ? tIdx + 1 : tIdx;
      updated = [
        ...updated.slice(0, insertIdx),
        newCriterion,
        ...updated.slice(insertIdx),
      ];
    }
    updateCourse({ criteria: updated });
  };

  const handleSubItemDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    criterionId: string,
    subItemId: string,
  ) => {
    event.stopPropagation();
    const key = `subitem:${criterionId}:${subItemId}`;
    draggingIdRef.current = key;
    setDraggingSubItemId(subItemId);
    setDraggingSubItemParentId(criterionId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", key);
  };

  const handleSubItemDragEnd = () => {
    draggingIdRef.current = null;
    setDraggingSubItemId(null);
    setDraggingSubItemParentId(null);
  };

  const handleSubItemDropOnSibling = (
    event: React.DragEvent<HTMLDivElement>,
    parentCriterionId: string,
    targetSubItemId: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const raw =
      draggingIdRef.current || event.dataTransfer.getData("text/plain");
    if (!raw) return;
    draggingIdRef.current = null;
    setDraggingSubItemId(null);
    setDraggingSubItemParentId(null);
    if (!raw.startsWith("subitem:")) return;
    const [, srcParentId, srcSubItemId] = raw.split(":");
    if (srcSubItemId === targetSubItemId) return;
    if (srcParentId === parentCriterionId) {
      const rect = event.currentTarget.getBoundingClientRect();
      const after = event.clientY - rect.top > rect.height / 2;
      moveSubItemWithinParent(
        parentCriterionId,
        srcSubItemId,
        targetSubItemId,
        after,
      );
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      const after = event.clientY - rect.top > rect.height / 2;
      promoteSubItemToCriterion(
        srcParentId,
        srcSubItemId,
        parentCriterionId,
        after ? "after" : "before",
      );
    }
  };

  const getSubItemWeightValue = (subItem: {
    id: string;
    weight?: number;
  }): string => {
    const d = subItemWeightDrafts[subItem.id];
    if (d !== undefined) return d;
    return subItem.weight !== undefined && subItem.weight > 0
      ? subItem.weight.toString()
      : "";
  };

  const handleSubItemWeightChange = (subItemId: string, raw: string) => {
    setSubItemWeightDrafts((prev) => ({ ...prev, [subItemId]: raw }));
  };

  const handleSubItemWeightBlur = (
    criterionId: string,
    subItem: { id: string; weight?: number },
  ) => {
    const draft = subItemWeightDrafts[subItem.id];
    if (draft === undefined) return;
    const parsed = parseFractionOrNumber(draft);
    const value =
      parsed !== null
        ? Math.max(0, Math.min(100, Number(parsed.toFixed(2))))
        : 0;
    updateSubItem(criterionId, subItem.id, { weight: value || undefined });
    setSubItemWeightDrafts((prev) => {
      const next = { ...prev };
      delete next[subItem.id];
      return next;
    });
  };

  const formatNumberValue = (value: number | null | undefined) => {
    if (
      value === undefined ||
      value === null ||
      Number.isNaN(value) ||
      value === 0
    )
      return "";
    return value.toString();
  };

  const getCriterionInputValue = (
    criterion: Criterion,
    field: CriterionNumericField,
  ): string => {
    const draftValue = criterionDrafts[criterion.id]?.[field];
    if (draftValue !== undefined) return draftValue;
    switch (field) {
      case "weight":
        return formatNumberValue(criterion.weight);
      case "score":
        return formatNumberValue(criterion.score);
      case "dropLowest":
        return formatNumberValue(criterion.dropLowest);
      case "extraCredit":
        return formatNumberValue(criterion.extraCredit);
      default:
        return "";
    }
  };

  const setCriterionDraftValue = (
    criterionId: string,
    field: CriterionNumericField,
    value: string,
  ) => {
    setCriterionDrafts((prev) => ({
      ...prev,
      [criterionId]: {
        ...prev[criterionId],
        [field]: value,
      },
    }));
  };

  const setCriterionNameDraftValue = (criterionId: string, value: string) => {
    setCriterionNameDrafts((prev) => ({
      ...prev,
      [criterionId]: value,
    }));
  };

  const clearCriterionNameDraftValue = (criterionId: string) => {
    setCriterionNameDrafts((prev) => {
      if (!(criterionId in prev)) return prev;
      const next = { ...prev };
      delete next[criterionId];
      return next;
    });
  };

  const commitCriterionName = (criterion: Criterion) => {
    const draftValue = criterionNameDrafts[criterion.id];
    if (draftValue === undefined) return;
    const trimmed = draftValue.trim();
    clearCriterionNameDraftValue(criterion.id);
    const nextName = trimmed.length > 0 ? trimmed : "";
    if (nextName === criterion.name) {
      return;
    }
    updateCriterion(criterion.id, { name: nextName });
  };

  const clearCriterionDraftValue = (
    criterionId: string,
    field: CriterionNumericField,
  ) => {
    setCriterionDrafts((prev) => {
      const current = prev[criterionId];
      if (!current || !(field in current)) return prev;
      const { [field]: _, ...remaining } = current;
      const next = { ...prev };
      if (Object.keys(remaining).length === 0) {
        delete next[criterionId];
      } else {
        next[criterionId] = remaining;
      }
      return next;
    });
  };

  const commitCriterionValue = (
    criterion: Criterion,
    field: CriterionNumericField,
    value: number | string,
  ) => {
    const numericValue =
      typeof value === "number" && Number.isFinite(value)
        ? value
        : Number.parseFloat(String(value ?? 0));
    const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
    const normalized = Math.max(0, Number.parseFloat(safeValue.toFixed(2)));
    if (field === "dropLowest") {
      const maxDroppable = Math.max(0, (criterion.subItems?.length ?? 0) - 1);
      const clamped = Math.min(maxDroppable, Math.floor(normalized));
      updateCriterion(criterion.id, { dropLowest: clamped });
      return;
    }

    if (field === "weight") {
      updateCriterion(criterion.id, { weight: normalized });
      return;
    }
    if (field === "score") {
      updateCriterion(criterion.id, { score: normalized });
      return;
    }
    if (field === "extraCredit") {
      updateCriterion(criterion.id, { extraCredit: normalized });
    }
  };

  const handleCriterionInputChange = (
    criterion: Criterion,
    field: CriterionNumericField,
    rawValue: string,
  ) => {
    setCriterionDraftValue(criterion.id, field, rawValue);
    commitCriterionValue(criterion, field, rawValue);
  };

  const handleCriterionInputBlur = (
    criterion: Criterion,
    field: CriterionNumericField,
  ) => {
    const draftValue = criterionDrafts[criterion.id]?.[field];
    if (draftValue === undefined) return;
    const parsed =
      field === "score"
        ? parseScoreInput(draftValue, course.gradeScale)
        : field === "dropLowest"
          ? parseDraftNumber(draftValue)
          : parseFractionOrNumber(draftValue);
    commitCriterionValue(criterion, field, parsed ?? 0);
    clearCriterionDraftValue(criterion.id, field);
  };

  const getSubItemInputValue = (subItem: SubItem): string => {
    const draftValue = subItemDrafts[subItem.id];
    if (draftValue !== undefined) return draftValue;
    return formatNumberValue(subItem.score);
  };

  const handleSubItemChange = (
    criterionId: string,
    subItemId: string,
    rawValue: string,
  ) => {
    setSubItemDrafts((prev) => ({
      ...prev,
      [subItemId]: rawValue,
    }));
  };

  const handleSubItemBlur = (criterionId: string, subItemId: string) => {
    const draftValue = subItemDrafts[subItemId];
    if (draftValue === undefined) return;
    const parsed = parseScoreInput(draftValue, course.gradeScale);
    updateSubItem(criterionId, subItemId, { score: Math.max(0, parsed ?? 0) });
    setSubItemDrafts((prev) => {
      const next = { ...prev };
      delete next[subItemId];
      return next;
    });
  };

  const handleEnterCommit = (
    event: React.KeyboardEvent<HTMLInputElement>,
    onCommit?: () => void,
  ) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    onCommit?.();
    const target = event.currentTarget;
    window.getSelection()?.removeAllRanges();
    target.blur();
  };

  // Expand or collapse a criterion’s sub-item list
  const toggleExpanded = (criterionId: string) => {
    setExpandedCriteria((prev) => {
      const next = new Set(prev);
      if (next.has(criterionId)) next.delete(criterionId);
      else next.add(criterionId);
      return next;
    });
  };

  // Calculate what score to display for a criterion (average of sub-items or its own score)
  const getCriterionDisplayScore = (criterion: Criterion): number => {
    const draftDropValue = criterionDrafts[criterion.id]?.dropLowest;
    const draftDropParsed =
      draftDropValue !== undefined ? parseDraftNumber(draftDropValue) : null;
    const dropSetting =
      draftDropParsed !== null && draftDropParsed !== undefined
        ? draftDropParsed
        : draftDropValue?.trim() === ""
          ? 0
          : (criterion.dropLowest ?? 0);

    if (criterion.subItems && criterion.subItems.length > 0) {
      const items = criterion.subItems;
      const hasWeights = items.some(
        (item) => item.weight !== undefined && item.weight > 0,
      );
      const maxDroppable = Math.max(0, items.length - 1);
      const dropCount = Math.min(
        Math.max(0, Math.floor(dropSetting)),
        maxDroppable,
      );
      let effectiveItems = items.map((item) => ({
        score: item.score || 0,
        weight: item.weight,
      }));
      if (dropCount > 0) {
        effectiveItems = [...effectiveItems]
          .sort((a, b) => a.score - b.score)
          .slice(dropCount);
      }
      if (effectiveItems.length === 0) return 0;
      if (hasWeights) {
        return effectiveItems.reduce(
          (sum, item) => sum + (item.score * (item.weight ?? 0)) / 100,
          0,
        );
      }
      return (
        effectiveItems.reduce((sum, item) => sum + item.score, 0) /
        effectiveItems.length
      );
    }
    return criterion.score;
  };

  const passFailSettings = useMemo(
    () => ({
      passLabel: (course.passLabel ?? "P").trim() || "P",
      failLabel: (course.failLabel ?? "F").trim() || "F",
      threshold: Math.min(100, Math.max(0, course.passThreshold ?? 60)),
    }),
    [course.failLabel, course.passLabel, course.passThreshold],
  );

  const passFailScale = useMemo(
    () => buildPassFailScale(passFailSettings),
    [passFailSettings],
  );
  const passFailLabel = useMemo(
    () =>
      numericGrade >= passFailSettings.threshold
        ? passFailSettings.passLabel
        : passFailSettings.failLabel,
    [numericGrade, passFailSettings],
  );

  const cardBackgroundStyle = useMemo(() => {
    const color = getMonochromeCardColor(course.cardColor);
    return color ? { backgroundColor: color } : undefined;
  }, [course.cardColor]);

  const handlePassFailToggle = useCallback(
    (value: boolean) => {
      if (value) {
        const snapshot = course.gradeScaleSnapshot
          ? cloneGradeScale(course.gradeScaleSnapshot)
          : cloneGradeScale(course.gradeScale);
        updateCourse({
          isPassFail: true,
          gradeScaleSnapshot: snapshot,
          gradeScale: passFailScale,
        });
        return;
      }

      const restoredScale = course.gradeScaleSnapshot
        ? cloneGradeScale(course.gradeScaleSnapshot)
        : DEFAULT_GRADE_SCALE.map((grade) => ({ ...grade }));

      updateCourse({
        isPassFail: false,
        gradeScale: restoredScale,
        gradeScaleSnapshot: undefined,
      });
    },
    [course.gradeScale, course.gradeScaleSnapshot, passFailScale, updateCourse],
  );

  const handleDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    criterionId: string,
  ) => {
    const target = event.target as HTMLElement | null;
    if (target && target.closest(interactiveDragSelector)) {
      event.preventDefault();
      return;
    }
    draggingIdRef.current = criterionId;
    setDraggingCriterionId(criterionId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", criterionId);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleDragEnter = (
    event: React.DragEvent<HTMLDivElement>,
    targetId: string,
  ) => {
    event.preventDefault();
    if (dragOverIdRef.current === targetId) return;
    dragOverIdRef.current = targetId;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setSubDropTargetId(null);
    const sourceId = draggingIdRef.current;
    // Only allow nesting for criterion-to-criterion drags (not sub-item drags)
    if (sourceId && !sourceId.startsWith("subitem:") && sourceId !== targetId) {
      hoverTimerRef.current = setTimeout(() => {
        setSubDropTargetId(targetId);
      }, 500);
    }
  };

  const handleDragLeave = (
    event: React.DragEvent<HTMLDivElement>,
    targetId: string,
  ) => {
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    if (dragOverIdRef.current === targetId) {
      dragOverIdRef.current = null;
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      setSubDropTargetId(null);
    }
  };

  const handleDropOnCriterion = (
    event: React.DragEvent<HTMLDivElement>,
    targetId: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const raw =
      draggingIdRef.current || event.dataTransfer.getData("text/plain");
    if (!raw) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    dragOverIdRef.current = null;

    if (raw.startsWith("subitem:")) {
      const [, parentId, subItemId] = raw.split(":");
      draggingIdRef.current = null;
      setDraggingSubItemId(null);
      setDraggingSubItemParentId(null);
      setSubDropTargetId(null);
      setDraggingCriterionId(null);
      if (parentId === targetId) return; // dropped on own parent, ignore
      const rect = event.currentTarget.getBoundingClientRect();
      const after = event.clientY - rect.top > rect.height / 2;
      promoteSubItemToCriterion(
        parentId,
        subItemId,
        targetId,
        after ? "after" : "before",
      );
      return;
    }

    const sourceId = raw;
    if (subDropTargetId === targetId && sourceId !== targetId) {
      convertToSubCriterion(sourceId, targetId);
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      const dropAfter = event.clientY - rect.top > rect.height / 2;
      moveCriterion(sourceId, targetId, dropAfter ? "after" : "before");
    }
    draggingIdRef.current = null;
    setSubDropTargetId(null);
    setDraggingCriterionId(null);
  };

  const handleDragEnd = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    dragOverIdRef.current = null;
    draggingIdRef.current = null;
    setDraggingCriterionId(null);
    setSubDropTargetId(null);
    setDraggingSubItemId(null);
    setDraggingSubItemParentId(null);
  };

  const handleDropAtEnd = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const raw =
      draggingIdRef.current || event.dataTransfer.getData("text/plain");
    if (!raw) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    dragOverIdRef.current = null;
    draggingIdRef.current = null;
    setSubDropTargetId(null);
    if (raw.startsWith("subitem:")) {
      const [, parentId, subItemId] = raw.split(":");
      setDraggingSubItemId(null);
      setDraggingSubItemParentId(null);
      promoteSubItemToCriterion(parentId, subItemId, null, "after");
    } else {
      moveCriterion(raw, null, "after");
      setDraggingCriterionId(null);
    }
  };

  return (
    <Card
      className={`border-2 shadow-under-white transition-all duration-300 ${highlighted ? "border-primary ring-2 ring-primary/40 ring-offset-2" : "border-primary/35"}`}
      style={cardBackgroundStyle}
    >
      {/* Course header with title, collapse toggle, delete button, and grade scale editor */}
      <CardHeader className="">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            {/* Editable course name input */}
            <div className="flex flex-wrap items-center gap-3">
              <Input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitCourseName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    commitCourseName();
                    e.currentTarget.blur();
                  }
                }}
                className="max-w-md border-2 border-primary/20 bg-card text-lg font-semibold"
                placeholder="Course Name"
              />
              {course.isPassFail && (
                <Badge className="border border-grey-500/50 bg-grey-100/80 text-grey-900">
                  Pass/Fail
                </Badge>
              )}
              {/* Collapse/expand button */}
              <Button
                variant="outline"
                size="sm"
                onClick={toggleCollapse}
                className="gap-2 bg-card"
              >
                {course.collapsed ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </Button>

              {onDuplicate && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDuplicate}
                  className="gap-2 bg-card"
                  title="Duplicate course"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              )}

              {/* Grade scale dialog */}
              <Dialog open={isScaleOpen} onOpenChange={setIsScaleOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 bg-card"
                  >
                    <Settings className="h-4 w-4" />
                    Grade Scale
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl [&]:border-primary/20 [&]:focus-visible:outline-none [&]:focus-visible:ring-0">
                  <DialogHeader>
                    <DialogTitle>Edit Grade Scale</DialogTitle>
                  </DialogHeader>
                  <GradeScaleEditor
                    gradeScale={course.gradeScale}
                    isPassFail={course.isPassFail ?? false}
                    onPassFailChange={handlePassFailToggle}
                    passFailSettings={passFailSettings}
                    onPassFailSettingsChange={(settings) =>
                      updateCourse({
                        passLabel: settings.passLabel,
                        failLabel: settings.failLabel,
                        passThreshold: settings.threshold,
                      })
                    }
                    onUpdate={(gradeScale) => {
                      updateCourse({ gradeScale });
                    }}
                  />
                </DialogContent>
              </Dialog>
            </div>

            {/* Credit hours input */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor={`credits-${course.id}`}
                  className="text-sm font-medium"
                >
                  Credit:
                </Label>
                <input
                  id={`credits-${course.id}`}
                  type="text"
                  inputMode="decimal"
                  value={creditsDraft}
                  onFocus={() => setCreditsFocused(true)}
                  onChange={(e) => setCreditsDraft(e.target.value)}
                  onBlur={() => {
                    setCreditsFocused(false);
                    commitCredits();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setCreditsFocused(false);
                      commitCredits();
                      e.currentTarget.blur();
                    }
                  }}
                  placeholder="0"
                  className="w-20 rounded-md border-2 border-primary/20 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/50"
                />
              </div>
              {courseCriteria.length > 0 && (
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor={`boost-${course.id}`}
                    className="text-sm font-medium"
                  >
                    Boost (%):
                  </Label>
                  <input
                    id={`boost-${course.id}`}
                    type="text"
                    inputMode="decimal"
                    value={percentBoostDraft}
                    onFocus={() => setPercentBoostFocused(true)}
                    onChange={(e) => setPercentBoostDraft(e.target.value)}
                    onBlur={() => {
                      setPercentBoostFocused(false);
                      commitPercentBoost();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setPercentBoostFocused(false);
                        commitPercentBoost();
                        e.currentTarget.blur();
                      }
                    }}
                    placeholder="0"
                    className="w-24 rounded-md border-2 border-primary/20 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/50"
                    title="Percent boost applied to the final course grade"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => setColorPickerOpen((prev) => !prev)}
                title="Card Color"
              >
                <Palette className="h-4 w-4" />
              </Button>
              {colorPickerOpen && (
                <div
                  ref={colorPickerRef}
                  className="absolute right-0 top-10 z-20 min-w-[160px] rounded-xl border border-border/60 bg-card/95 p-3 shadow-under-white"
                >
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Card Color
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {courseColorOptions.map((option) => {
                      const isActive =
                        (course.cardColor ?? "") === (option.color ?? "");
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => updateCardColor(option.color)}
                          className={`h-6 w-6 rounded-full border-2 transition hover:scale-105 ${
                            isActive ? "border-foreground" : "border-border/40"
                          }`}
                          style={{
                            backgroundColor: option.color || "transparent",
                          }}
                          title={option.label}
                        >
                          {option.color === "" && (
                            <span className="block h-full w-full rounded-full bg-muted" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              title="Export Course"
              onClick={() => onExportCourse?.(course.id)}
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant={whatIfMode ? "default" : "outline"}
              size="icon"
              className="shrink-0"
              title={whatIfMode ? "Exit What-If Mode" : "What-If Mode"}
              onClick={() => {
                if (!whatIfMode) {
                  const initial: Record<string, string> = {};
                  for (const c of courseCriteria) initial[c.id] = c.score > 0 ? String(c.score) : "";
                  setWhatIfScores(initial);
                }
                setWhatIfMode((prev) => !prev);
              }}
            >
              <FlaskConical className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              size="icon"
              onClick={() => onDelete(course.id)}
              className="shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Course content — animated expand/collapse */}
      <AnimatePresence initial={false} mode="wait">
      {!course.collapsed ? (
        <motion.div
          key="expanded"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          style={{ overflow: "hidden" }}
        >
        <CardContent className="pt-6">
          {/* Weighted criteria section */}
          <div
            className="space-y-4"
            onDragOver={handleDragOver}
            onDrop={handleDropAtEnd}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-primary">Distribution</h3>
              {courseCriteria.length > 0 && (
                <span
                  className={`text-xs font-semibold ${
                    totalWeight === 100
                      ? "text-primary"
                      : "rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-amber-700"
                  }`}
                >
                  {totalWeight}%{totalWeight !== 100 && " ≠ 100"}
                </span>
              )}
            </div>

            {/* Render all criteria */}
            {courseCriteria.map((criterion) => {
              const criterionKey = criterion.clientId ?? criterion.id;
              const hasSubItems =
                criterion.subItems && criterion.subItems.length > 0;
              const isExpanded = expandedCriteria.has(criterionKey);
              const displayScore = getCriterionDisplayScore(criterion);
              const isDragging = draggingCriterionId === criterion.id;

              return (
                <div key={criterionKey} className="space-y-2">
                  {/* Criterion row */}
                  <div
                    className={`relative flex items-start gap-2 rounded-lg border-2 pt-3 px-3 pb-5 transition-all ${
                      isDragging
                        ? "border-primary/20 bg-muted/30 opacity-40"
                        : subDropTargetId === criterion.id
                          ? "border-dashed border-red-500 bg-red-500/5"
                          : "border-primary/20 bg-muted/30"
                    }`}
                    draggable
                    onDragStart={(event) =>
                      handleDragStart(event, criterion.id)
                    }
                    onDragOver={handleDragOver}
                    onDragEnter={(event) =>
                      handleDragEnter(event, criterion.id)
                    }
                    onDragLeave={(event) =>
                      handleDragLeave(event, criterion.id)
                    }
                    onDrop={(event) =>
                      handleDropOnCriterion(event, criterion.id)
                    }
                    onDragEnd={handleDragEnd}
                  >
                    {/* Drag handle */}
                    <div className="mt-6 flex shrink-0 cursor-grab items-center active:cursor-grabbing">
                      <GripVertical className="h-4 w-4 text-muted-foreground/40 transition-colors hover:text-muted-foreground" />
                    </div>

                    {/* Fields grid */}
                    <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]">
                      {/* Criterion name */}
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Name
                        </Label>
                        <Input
                          value={
                            criterionNameDrafts[criterion.id] ??
                            criterion.name ??
                            ""
                          }
                          onChange={(e) =>
                            setCriterionNameDraftValue(
                              criterion.id,
                              e.target.value,
                            )
                          }
                          onBlur={() => commitCriterionName(criterion)}
                          onKeyDown={(e) =>
                            handleEnterCommit(e, () =>
                              commitCriterionName(criterion),
                            )
                          }
                          className="border-primary/20"
                          placeholder="e.g., Assignments"
                        />
                      </div>

                      {/* Criterion weight */}
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Weight (%)
                        </Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={getCriterionInputValue(criterion, "weight")}
                          onChange={(e) =>
                            handleCriterionInputChange(
                              criterion,
                              "weight",
                              e.target.value,
                            )
                          }
                          onBlur={() =>
                            handleCriterionInputBlur(criterion, "weight")
                          }
                          onKeyDown={(e) =>
                            handleEnterCommit(e, () =>
                              handleCriterionInputBlur(criterion, "weight"),
                            )
                          }
                          placeholder="0"
                          className="border-primary/20"
                        />
                      </div>

                      {/* Criterion score or avg of subitems */}
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {hasSubItems ? "Avg Score (%)" : "Score (%)"}
                        </Label>
                        {hasSubItems ? (
                          <div className="flex h-10 items-center rounded-md border-2 border-primary/20 bg-muted px-3 text-sm font-medium">
                            {displayScore.toFixed(1)}%
                          </div>
                        ) : (
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={getCriterionInputValue(criterion, "score")}
                            onChange={(e) =>
                              handleCriterionInputChange(
                                criterion,
                                "score",
                                e.target.value,
                              )
                            }
                            onBlur={() =>
                              handleCriterionInputBlur(criterion, "score")
                            }
                            onKeyDown={(e) =>
                              handleEnterCommit(e, () =>
                                handleCriterionInputBlur(criterion, "score"),
                              )
                            }
                            placeholder="0"
                            className="border-primary/20"
                          />
                        )}
                      </div>

                      {/* What-If score */}
                      {whatIfMode && (
                        <div>
                          <Label className="text-xs font-semibold text-primary/80">
                            What-If (%)
                          </Label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={whatIfScores[criterion.id] ?? ""}
                            onChange={(e) =>
                              setWhatIfScores((prev) => ({
                                ...prev,
                                [criterion.id]: e.target.value,
                              }))
                            }
                            placeholder={String(criterion.score || 0)}
                            className="border-primary/50 bg-primary/5"
                          />
                        </div>
                      )}

                      {/* Extra credit */}
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Extra Credit (%)
                        </Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={getCriterionInputValue(
                            criterion,
                            "extraCredit",
                          )}
                          onChange={(e) =>
                            handleCriterionInputChange(
                              criterion,
                              "extraCredit",
                              e.target.value,
                            )
                          }
                          onBlur={() =>
                            handleCriterionInputBlur(criterion, "extraCredit")
                          }
                          onKeyDown={(e) =>
                            handleEnterCommit(e, () =>
                              handleCriterionInputBlur(
                                criterion,
                                "extraCredit",
                              ),
                            )
                          }
                          placeholder="0"
                          className="border-primary/20"
                          title="Adds to this criterion before weighting"
                        />
                      </div>

                      {/* Drop lowest X (only shown if has sub-items) */}
                      <div>
                        {hasSubItems ? (
                          <>
                            <Label className="text-xs text-muted-foreground">
                              Drop Lowest
                            </Label>
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={getCriterionInputValue(
                                criterion,
                                "dropLowest",
                              )}
                              onChange={(e) =>
                                handleCriterionInputChange(
                                  criterion,
                                  "dropLowest",
                                  e.target.value,
                                )
                              }
                              onBlur={() =>
                                handleCriterionInputBlur(
                                  criterion,
                                  "dropLowest",
                                )
                              }
                              onKeyDown={(e) =>
                                handleEnterCommit(e, () =>
                                  handleCriterionInputBlur(
                                    criterion,
                                    "dropLowest",
                                  ),
                                )
                              }
                              placeholder="0"
                              className="border-primary/20"
                              title="Number of lowest scores to drop"
                            />
                          </>
                        ) : (
                          <div className="h-10" />
                        )}
                      </div>

                      {/* Buttons for subitems & delete */}
                      <div className="flex items-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => addSubItem(criterion.id)}
                          className="text-primary hover:bg-primary/10"
                          title="Add sub-item"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        {hasSubItems && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleExpanded(criterionKey)}
                            className="text-muted-foreground hover:bg-muted"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => duplicateCriterion(criterion.id)}
                          className="text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Duplicate criterion"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteCriterion(criterion.id)}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {/* end fields grid */}
                  </div>
                  {/* end criterion row */}

                  {/* Sub-items section (if expanded) */}
                  {hasSubItems && isExpanded && (
                    <div className="ml-4 space-y-2 border-l-2 border-primary/20 pl-4">
                      {criterion.subItems!.map((subItem) => (
                        <div
                          key={subItem.id}
                          draggable
                          onDragStart={(e) =>
                            handleSubItemDragStart(e, criterion.id, subItem.id)
                          }
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) =>
                            handleSubItemDropOnSibling(
                              e,
                              criterion.id,
                              subItem.id,
                            )
                          }
                          onDragEnd={handleSubItemDragEnd}
                          className={`grid grid-cols-1 gap-2 rounded-md border bg-card p-3 sm:grid-cols-[auto_2fr_1fr_1fr_auto] transition-opacity ${
                            draggingSubItemId === subItem.id
                              ? "opacity-40 border-dashed border-red-500/80"
                              : "border-primary/10"
                          }`}
                        >
                          <div className="flex items-center pt-5">
                            <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">
                              Name
                            </Label>
                            <Input
                              value={subItem.name}
                              onChange={(e) =>
                                updateSubItem(criterion.id, subItem.id, {
                                  name: e.target.value,
                                })
                              }
                              className="h-9 border-primary/20"
                              placeholder="e.g., Homework 1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">
                              Score (%)
                            </Label>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={getSubItemInputValue(subItem)}
                              onChange={(e) =>
                                handleSubItemChange(
                                  criterion.id,
                                  subItem.id,
                                  e.target.value,
                                )
                              }
                              onBlur={() =>
                                handleSubItemBlur(criterion.id, subItem.id)
                              }
                              onKeyDown={(e) =>
                                handleEnterCommit(e, () =>
                                  handleSubItemBlur(criterion.id, subItem.id),
                                )
                              }
                              placeholder="0"
                              className="h-9 border-primary/20"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">
                              Weight (%)
                            </Label>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={getSubItemWeightValue(subItem)}
                              onChange={(e) =>
                                handleSubItemWeightChange(
                                  subItem.id,
                                  e.target.value,
                                )
                              }
                              onBlur={() =>
                                handleSubItemWeightBlur(criterion.id, subItem)
                              }
                              onKeyDown={(e) =>
                                handleEnterCommit(e, () =>
                                  handleSubItemWeightBlur(
                                    criterion.id,
                                    subItem,
                                  ),
                                )
                              }
                              placeholder="equal"
                              className="h-9 border-primary/20"
                              title="Weight of this sub-item (100% = full criterion weight)"
                            />
                          </div>
                          <div className="flex items-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                duplicateSubItem(criterion.id, subItem.id)
                              }
                              className="h-9 w-9 text-muted-foreground hover:bg-muted hover:text-foreground"
                              title="Duplicate sub-item"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                deleteSubItem(criterion.id, subItem.id)
                              }
                              className="h-9 w-9 text-destructive hover:bg-destructive/10"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {courseCriteria.length > 0 && (
              <div
                className="h-4 rounded border-2 border-dashed border-transparent"
                onDragOver={handleDragOver}
                onDrop={handleDropAtEnd}
              />
            )}

            {courseCriteria.length === 0 && (
              <div className="rounded-lg border-2 border-dashed border-primary/20 py-8 text-center text-muted-foreground">
                <p className="text-sm">No criteria yet — add one below to start tracking your grade.</p>
              </div>
            )}

            {/* Button to add a new criterion */}
            <Button
              onClick={addCriterion}
              variant="outline"
              size="sm"
              className="w-full gap-2 border-2 border-dashed border-primary/30 bg-transparent"
            >
              <Plus className="h-4 w-4" />
              Add Criterion
            </Button>
          </div>

          {/* Course grade summary (bottom of expanded card) */}
          <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5/60 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  Numeric Grade
                  {courseCriteria.length === 0 && !directGradeEditing && (
                    <button
                      type="button"
                      onClick={() => {
                        setDirectGradeDraft(numericGrade > 0 ? String(numericGrade) : "");
                        setDirectGradeEditing(true);
                      }}
                      className="ml-0.5 rounded p-0.5 text-muted-foreground/50 hover:text-primary transition-colors"
                      title="Enter final grade"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                </p>
                {courseCriteria.length === 0 && directGradeEditing ? (
                  <input
                    type="text"
                    inputMode="decimal"
                    autoFocus
                    value={directGradeDraft}
                    onChange={(e) => setDirectGradeDraft(e.target.value)}
                    onBlur={() => {
                      const parsed = Number.parseFloat(directGradeDraft.trim());
                      const normalized = !Number.isNaN(parsed) ? Math.min(100, Math.max(0, Number.parseFloat(parsed.toFixed(2)))) : 0;
                      setPercentBoostDraft(normalized > 0 ? String(normalized) : "");
                      updateCourse({ percentBoost: normalized });
                      setDirectGradeEditing(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") { setDirectGradeEditing(false); }
                    }}
                    placeholder="0–100"
                    className="mt-1 w-32 rounded-md border-2 border-primary/40 bg-transparent px-3 py-1 text-3xl font-bold text-primary outline-none focus:border-primary"
                  />
                ) : (
                  <p className="mt-1 text-4xl font-bold text-primary">
                    <RollingNumber value={numericGrade} decimals={2} />%
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-muted-foreground">
                  {course.isPassFail ? "Pass/Fail" : "Letter Grade"}
                </p>
                <p
                  className="mt-1 text-5xl font-bold"
                  style={{ color: course.isPassFail ? "#6b7280" : gradeColor }}
                >
                  {course.isPassFail ? passFailLabel : letterGrade}
                </p>
              </div>
            </div>
            {whatIfMode && (
              <div className="mt-4 border-t border-primary/20 pt-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-primary/70">
                  <FlaskConical className="h-3 w-3" />
                  What-If
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-3xl font-bold text-primary/80">
                    <RollingNumber value={whatIfNumericGrade} decimals={2} />%
                  </p>
                  <p className="text-4xl font-bold" style={{ color: whatIfGradeColor }}>
                    {whatIfLetterGrade}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
        </motion.div>
      ) : (
        <motion.div
          key="collapsed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
        <CardContent className="pt-4 pb-6">
          <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5/60 p-4">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                Numeric Grade
                {courseCriteria.length === 0 && !directGradeEditing && (
                  <button
                    type="button"
                    onClick={() => {
                      setDirectGradeDraft(numericGrade > 0 ? String(numericGrade) : "");
                      setDirectGradeEditing(true);
                    }}
                    className="ml-0.5 rounded p-0.5 text-muted-foreground/50 hover:text-primary transition-colors"
                    title="Enter final grade"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </p>
              {courseCriteria.length === 0 && directGradeEditing ? (
                <input
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  value={directGradeDraft}
                  onChange={(e) => setDirectGradeDraft(e.target.value)}
                  onBlur={() => {
                    const parsed = Number.parseFloat(directGradeDraft.trim());
                    const normalized = !Number.isNaN(parsed) ? Math.min(100, Math.max(0, Number.parseFloat(parsed.toFixed(2)))) : 0;
                    setPercentBoostDraft(normalized > 0 ? String(normalized) : "");
                    updateCourse({ percentBoost: normalized });
                    setDirectGradeEditing(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") { setDirectGradeEditing(false); }
                  }}
                  placeholder="0–100"
                  className="mt-1 w-28 rounded-md border-2 border-primary/40 bg-transparent px-2 py-0.5 text-2xl font-bold text-primary outline-none focus:border-primary"
                />
              ) : (
                <p className="mt-1 text-2xl font-bold text-primary">
                  <RollingNumber value={numericGrade} decimals={2} />%
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-muted-foreground">
                {course.isPassFail ? "Pass/Fail" : "Letter Grade"}
              </p>
              <p
                className="mt-1 text-3xl font-bold"
                style={{ color: course.isPassFail ? "#6b7280" : gradeColor }}
              >
                {course.isPassFail ? passFailLabel : letterGrade}
              </p>
            </div>
          </div>
        </CardContent>
        </motion.div>
      )}
      </AnimatePresence>
    </Card>
  );
}
