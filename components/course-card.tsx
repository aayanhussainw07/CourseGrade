"use client";

import type React from "react";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Trash2,
  Plus,
  Settings,
  ChevronDown,
  ChevronUp,
  Copy,
  Pencil,
} from "lucide-react";
import {
  calculateCourseGrade,
  cloneGradeScale,
  getLetterGrade,
  getLetterGradeColor,
  isCourseDefault,
} from "@/lib/grade-utils";
import type { Course, Criterion, SubItem, GradeScale } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { GradeScaleEditor } from "@/components/grade-scale-editor";
import { RollingNumber } from "@/components/rolling-number";
import { DEFAULT_GRADE_SCALE } from "@/lib/types";
import { parseScoreInput } from "@/lib/score-input";
import { CriterionRow } from "@/components/course/CriterionRow";
import { HeaderColorPicker } from "@/components/course/HeaderColorPicker";
import { CourseContext } from "@/components/course/CourseContext";
import type { DragIntent, DropIndicator } from "@/components/course/CourseContext";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";

const COLLAPSED_PAPER_ROTATIONS = [
  "rotate-[-0.35deg]",
  "rotate-[0.2deg]",
  "rotate-[-0.15deg]",
  "rotate-[0.35deg]",
];

const getStableIndex = (value: string, modulo: number) => {
  let total = 0;
  for (let i = 0; i < value.length; i += 1) {
    total += value.charCodeAt(i);
  }
  return total % modulo;
};

const paperShadow =
  "shadow-[0_3px_0_rgba(198,90,78,0.20),0_10px_18px_rgba(77,31,26,0.08)]";

const paperTapeClass =
  "pointer-events-none absolute -top-2 h-5 w-20 bg-primary/15";

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

interface CourseCardProps {
  course: Course;
  highlighted?: boolean;
  onUpdate: (id: string, course: Course) => void | Promise<void>;
  onDelete: (id: string) => void;
  onDuplicate?: () => void;
}

export function CourseCard({
  course,
  highlighted = false,
  onUpdate,
  onDelete,
  onDuplicate,
}: CourseCardProps) {
  const [isScaleOpen, setIsScaleOpen] = useState(false);
  const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(
    new Set(),
  );
  const [nameDraft, setNameDraft] = useState(course.name);
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
  const [draggingCriterionId, setDraggingCriterionId] = useState<string | null>(null);
  const [draggingSubItemId, setDraggingSubItemId] = useState<string | null>(null);
  const [draggingSubItemParentId, setDraggingSubItemParentId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const draggingIdRef = useRef<string | null>(null);
  const dragStartXRef = useRef<number>(0);
  const [directGradeEditing, setDirectGradeEditing] = useState(false);
  const [directGradeDraft, setDirectGradeDraft] = useState("");
  const interactiveDragSelector =
    "button, input, textarea, select, a[href], [contenteditable='true'], [role='button'], [draggable='false']";
  const collapsedPaperRotation =
    COLLAPSED_PAPER_ROTATIONS[
      getStableIndex(course.id, COLLAPSED_PAPER_ROTATIONS.length)
    ];
  const paperShellClass = `${paperShadow} relative rounded-xl border-2 bg-[#fff8f1] text-card-foreground backdrop-blur-xl transition-all duration-300 ${
    highlighted && !course.collapsed
      ? "border-primary ring-2 ring-primary/40 ring-offset-2"
      : "border-primary/25"
  }`;

  useEffect(() => {
    setNameDraft(course.name);
  }, [course.name]);

  useEffect(() => {
    if (creditsFocused) return;
    if ((course.credits ?? 0) === 0 && creditsDraft === "") return;
    setCreditsDraft(formatCreditsDraft(course.credits));
  }, [course.credits, creditsFocused, creditsDraft]);

  useEffect(() => {
    if (percentBoostFocused) return;
    if ((course.percentBoost ?? 0) === 0 && percentBoostDraft === "") return;
    setPercentBoostDraft(formatPercentBoostDraft(course.percentBoost));
  }, [course.percentBoost, percentBoostDraft, percentBoostFocused]);

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

  const {
    numericGrade,
    letterGrade,
    gradeColor,
    totalWeight,
  } = useMemo(() => {
    const numeric = calculateCourseGrade(courseCriteria, course.percentBoost);
    const letter = getLetterGrade(numeric, course.gradeScale);
    return {
      numericGrade: numeric,
      letterGrade: letter,
      gradeColor: getLetterGradeColor(letter),
      totalWeight: courseCriteria.reduce((sum, c) => sum + c.weight, 0),
    };
  }, [courseCriteria, course.gradeScale, course.percentBoost]);

  const toggleCollapse = () => updateCourse({ collapsed: !course.collapsed });

  const updateCourseName = (name: string) => {
    if (name === course.name) return;
    updateCourse({ name });
  };
  const commitCourseName = () => updateCourseName(nameDraft);

  const commitCredits = () => {
    const trimmed = creditsDraft.trim();
    if (trimmed === "") {
      if ((course.credits ?? 0) !== 0) updateCourse({ credits: 0 });
      setCreditsDraft("");
      return;
    }
    const parsed = Number.parseFloat(trimmed);
    if (Number.isNaN(parsed)) {
      setCreditsDraft(formatCreditsDraft(course.credits));
      return;
    }
    const normalized = Math.max(0, Number.parseFloat(parsed.toFixed(2)));
    setCreditsDraft(normalized.toString());
    if (normalized === course.credits) return;
    updateCourse({ credits: normalized });
  };

  const commitPercentBoost = () => {
    const trimmed = percentBoostDraft.trim();
    if (trimmed === "") {
      if ((course.percentBoost ?? 0) !== 0) updateCourse({ percentBoost: 0 });
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
    if (normalized === (course.percentBoost ?? 0)) return;
    updateCourse({ percentBoost: normalized });
  };

  const updateHeaderColor = (colorValue: string) => {
    const normalized = colorValue || null;
    if ((course.headerColor ?? null) === normalized) return;
    updateCourse({ headerColor: normalized });
  };

  const requestCourseDelete = () => {
    if (isCourseDefault(course)) {
      onDelete(course.id);
      return;
    }
    setDeleteDialogOpen(true);
  };

  const deleteConfirmation = (
    <DeleteConfirmationDialog
      open={deleteDialogOpen}
      onOpenChange={setDeleteDialogOpen}
      itemName={course.name || "Untitled"}
      itemType="course"
      onConfirm={() => onDelete(course.id)}
    />
  );

  const startDirectGradeEdit = () => {
    if (courseCriteria.length > 0) return;
    setDirectGradeDraft(numericGrade > 0 ? String(numericGrade) : "");
    setDirectGradeEditing(true);
  };

  const commitDirectGrade = () => {
    const parsed = Number.parseFloat(directGradeDraft.trim());
    const normalized = !Number.isNaN(parsed)
      ? Math.min(100, Math.max(0, Number.parseFloat(parsed.toFixed(2))))
      : 0;
    setPercentBoostDraft(normalized > 0 ? String(normalized) : "");
    updateCourse({ percentBoost: normalized });
    setDirectGradeEditing(false);
  };

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
    updateCourse({ criteria: [...courseCriteria, newCriterion] });
  };

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
      const working = [
        ...(Array.isArray(courseCriteria) ? courseCriteria : []),
      ];
      const sourceIndex = working.findIndex((c) => c.id === sourceId);
      if (sourceIndex === -1) return;
      const [moved] = working.splice(sourceIndex, 1);
      if (!targetId) {
        if (position === "after") working.push(moved);
        else working.unshift(moved);
      } else {
        let targetIndex = working.findIndex((c) => c.id === targetId);
        if (targetIndex === -1) {
          working.push(moved);
        } else {
          if (position === "after") targetIndex += 1;
          working.splice(targetIndex, 0, moved);
        }
      }
      updateCourse({ criteria: working });
    },
    [courseCriteria, updateCourse],
  );

  const deleteCriterion = (id: string) => {
    updateCourse({ criteria: courseCriteria.filter((c) => c.id !== id) });
  };

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

  const convertToSubCriterion = (
    sourceId: string,
    targetId: string,
    adjacentSubItemId?: string | null,
    position: "before" | "after" = "after",
  ) => {
    if (sourceId === targetId) return;
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
    const targetSubItems = [...(target.subItems ?? [])];
    if (adjacentSubItemId) {
      const adjacentIndex = targetSubItems.findIndex(
        (item) => item.id === adjacentSubItemId,
      );
      const insertIndex =
        adjacentIndex === -1
          ? targetSubItems.length
          : position === "after"
            ? adjacentIndex + 1
            : adjacentIndex;
      targetSubItems.splice(insertIndex, 0, newSubItem);
    } else {
      targetSubItems.push(newSubItem);
    }
    const updatedTarget: Criterion = {
      ...target,
      subItems: targetSubItems,
    };
    const targetKey = target.clientId ?? target.id;
    setExpandedCriteria((prev) => new Set(prev).add(targetKey));
    updateCourse({
      criteria: courseCriteria
        .filter((c) => c.id !== sourceId)
        .map((c) => (c.id === targetId ? updatedTarget : c)),
    });
  };

  const addSubItem = (criterionId: string) => {
    const criterion = courseCriteria.find((c) => c.id === criterionId);
    if (!criterion) return;
    const newSubItem: SubItem = { id: crypto.randomUUID(), name: "", score: 0 };
    updateCriterion(criterionId, {
      subItems: [...(criterion.subItems || []), newSubItem],
    });
    const expandedKey = criterion.clientId ?? criterion.id;
    setExpandedCriteria((prev) => new Set(prev).add(expandedKey));
  };

  const updateSubItem = (
    criterionId: string,
    subItemId: string,
    updates: Partial<SubItem>,
  ) => {
    const criterion = courseCriteria.find((c) => c.id === criterionId);
    if (!criterion?.subItems) return;
    updateCriterion(criterionId, {
      subItems: criterion.subItems.map((item) =>
        item.id === subItemId ? { ...item, ...updates } : item,
      ),
    });
  };

  const deleteSubItem = (criterionId: string, subItemId: string) => {
    const criterion = courseCriteria.find((c) => c.id === criterionId);
    if (!criterion?.subItems) return;
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

  const NEST_THRESHOLD_PX = 60;

  const computeIntent = (
    e: React.DragEvent<HTMLDivElement>,
    targetId: string,
  ): DropIndicator | null => {
    const sourceId = draggingIdRef.current;
    if (!sourceId || sourceId === targetId) return null;
    const rect = e.currentTarget.getBoundingClientRect();
    const yRatio = (e.clientY - rect.top) / rect.height;
    const position: "before" | "after" = yRatio < 0.5 ? "before" : "after";
    const isSubItem = sourceId.startsWith("subitem:");
    const horizontalShift = e.clientX - dragStartXRef.current;

    let intent: DragIntent;
    if (isSubItem) {
      intent = horizontalShift < -NEST_THRESHOLD_PX ? "promote" : "reorder";
    } else {
      intent = horizontalShift > NEST_THRESHOLD_PX ? "nest" : "reorder";
    }
    return { targetId, position, intent };
  };

  const handleDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    criterionId: string,
  ) => {
    const target = event.target as HTMLElement | null;
    if (target && target.closest(interactiveDragSelector)) {
      event.preventDefault();
      return;
    }
    event.stopPropagation();
    draggingIdRef.current = criterionId;
    dragStartXRef.current = event.clientX;
    setDraggingCriterionId(criterionId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", criterionId);
  };

  const handleSubItemDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    criterionId: string,
    subItemId: string,
  ) => {
    const target = event.target as HTMLElement | null;
    if (target && target.closest(interactiveDragSelector)) {
      event.preventDefault();
      return;
    }
    event.stopPropagation();
    const key = `subitem:${criterionId}:${subItemId}`;
    draggingIdRef.current = key;
    dragStartXRef.current = event.clientX;
    setDraggingSubItemId(subItemId);
    setDraggingSubItemParentId(criterionId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", key);
  };

  const handleSubItemDragEnd = () => {
    draggingIdRef.current = null;
    setDraggingSubItemId(null);
    setDraggingSubItemParentId(null);
    setDropIndicator(null);
  };

  const handleDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    targetId: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    const indicator = computeIntent(event, targetId);
    if (indicator) {
      setDropIndicator(indicator);
    }
  };

  const handleDragLeave = (
    event: React.DragEvent<HTMLDivElement>,
    targetId: string,
  ) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDropIndicator((current) =>
      current?.targetId === targetId ? null : current,
    );
  };

  const handleSubItemDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    parentCriterionId: string,
    subItemId: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    const sourceId = draggingIdRef.current;
    if (!sourceId) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const position: "before" | "after" = (event.clientY - rect.top) / rect.height < 0.5 ? "before" : "after";
    const horizontalShift = event.clientX - dragStartXRef.current;

    const isSubItemSource = sourceId.startsWith("subitem:");
    let intent: DragIntent;
    if (isSubItemSource) {
      intent = horizontalShift < -NEST_THRESHOLD_PX ? "promote" : "reorder";
    } else {
      intent = "nest";
    }
    setDropIndicator({ targetId: `sub:${parentCriterionId}:${subItemId}`, position, intent });
  };

  const handleSubItemDragLeave = (
    event: React.DragEvent<HTMLDivElement>,
    parentCriterionId: string,
    subItemId: string,
  ) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    const targetId = `sub:${parentCriterionId}:${subItemId}`;
    setDropIndicator((current) =>
      current?.targetId === targetId ? null : current,
    );
  };

  const handleSubItemDrop = (
    event: React.DragEvent<HTMLDivElement>,
    parentCriterionId: string,
    targetSubItemId: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const raw = draggingIdRef.current || event.dataTransfer.getData("text/plain");
    if (!raw) return;

    const indicator = dropIndicator;
    clearDragState();

    if (!raw.startsWith("subitem:")) {
      if (raw === parentCriterionId) return;
      convertToSubCriterion(
        raw,
        parentCriterionId,
        targetSubItemId,
        indicator?.position ?? "after",
      );
      return;
    }

    if (raw.startsWith("subitem:")) {
      const [, srcParentId, srcSubItemId] = raw.split(":");
      if (srcSubItemId === targetSubItemId) return;

      if (indicator?.intent === "promote") {
        promoteSubItemToCriterion(srcParentId, srcSubItemId, parentCriterionId, indicator.position);
        return;
      }

      if (srcParentId === parentCriterionId) {
        const after = indicator?.position === "after";
        moveSubItemWithinParent(parentCriterionId, srcSubItemId, targetSubItemId, after);
      } else {
        promoteSubItemToCriterion(srcParentId, srcSubItemId, parentCriterionId, indicator?.position ?? "before");
      }
    }
  };

  const handleDropOnCriterion = (
    event: React.DragEvent<HTMLDivElement>,
    targetId: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const raw = draggingIdRef.current || event.dataTransfer.getData("text/plain");
    if (!raw) return;

    const indicator = dropIndicator;
    clearDragState();

    if (raw.startsWith("subitem:")) {
      const [, parentId, subItemId] = raw.split(":");
      if (parentId === targetId && indicator?.intent !== "promote") return;
      promoteSubItemToCriterion(
        parentId,
        subItemId,
        targetId,
        indicator?.position ?? "after",
      );
      return;
    }

    const sourceId = raw;
    if (sourceId === targetId) return;

    if (indicator?.intent === "nest") {
      convertToSubCriterion(sourceId, targetId);
    } else {
      moveCriterion(sourceId, targetId, indicator?.position ?? "after");
    }
  };

  const clearDragState = () => {
    draggingIdRef.current = null;
    setDraggingCriterionId(null);
    setDraggingSubItemId(null);
    setDraggingSubItemParentId(null);
    setDropIndicator(null);
  };

  const handleDragEnd = () => {
    clearDragState();
  };

  const handleDropAtEnd = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const raw = draggingIdRef.current || event.dataTransfer.getData("text/plain");
    if (!raw) return;
    clearDragState();
    if (raw.startsWith("subitem:")) {
      const [, parentId, subItemId] = raw.split(":");
      promoteSubItemToCriterion(parentId, subItemId, null, "after");
    } else {
      moveCriterion(raw, null, "after");
    }
  };

  const toggleExpanded = (criterionId: string) => {
    setExpandedCriteria((prev) => {
      const next = new Set(prev);
      if (next.has(criterionId)) next.delete(criterionId);
      else next.add(criterionId);
      return next;
    });
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
  const isDraggingGradeItem = Boolean(draggingCriterionId || draggingSubItemId);

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

  const gradeSummary = (collapsed: boolean) => (
    <div
      className={`relative flex items-center justify-between rounded-lg border border-primary/25 bg-[#fff8f1] shadow-[3px_4px_0_rgba(198,90,78,0.13)] ${collapsed ? "p-4" : "p-6"}`}
    >
      {!collapsed && (
        <div className="pointer-events-none absolute -top-2 right-8 h-5 w-16 rotate-3 bg-primary/15" />
      )}
      <div>
        <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          Numeric Grade
          {courseCriteria.length === 0 && !directGradeEditing && (
            <button
              type="button"
              onClick={startDirectGradeEdit}
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
            onBlur={commitDirectGrade}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setDirectGradeEditing(false);
            }}
            placeholder="0–100"
            className={`mt-1 rounded-md border-2 border-primary/40 bg-transparent px-3 py-1 font-bold text-primary outline-none focus:border-primary ${collapsed ? "w-28 py-0.5 text-2xl px-2" : "w-32 text-3xl"}`}
          />
        ) : (
          <p
            className={`mt-1 font-bold text-primary ${collapsed ? "text-2xl" : "text-4xl"}`}
          >
            <RollingNumber value={numericGrade} decimals={2} />%
          </p>
        )}
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-muted-foreground">
          {course.isPassFail ? "Pass/Fail" : "Letter Grade"}
        </p>
        <p
          className={`mt-1 font-bold ${collapsed ? "text-3xl" : "text-5xl"}`}
          style={{ color: course.isPassFail ? "#6b7280" : gradeColor }}
        >
          {course.isPassFail ? passFailLabel : letterGrade}
        </p>
        {!collapsed && (
          <Dialog open={isScaleOpen} onOpenChange={setIsScaleOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="mt-3 gap-2">
                <Settings className="h-4 w-4" />
                Curve
              </Button>
            </DialogTrigger>
            <DialogContent
              className="max-h-[85vh] max-w-2xl overflow-hidden border-2 border-primary/25 bg-[#fff8f1] p-0 text-foreground ![box-shadow:none] [&_*]:![box-shadow:none] [&]:focus-visible:outline-none [&]:focus-visible:ring-0"
              onOpenAutoFocus={(event) => event.preventDefault()}
            >
              <DialogHeader className="relative border-b border-primary/20 bg-[#fff3ea] px-6 pb-4 pt-6 text-left">
                <div className="pointer-events-none absolute -top-2 left-10 h-5 w-16 rotate-[-2deg] bg-primary/12" />
                <DialogTitle className="font-heading text-lg tracking-widest text-primary">
                  Edit Curve
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm text-muted-foreground">
                  Adjust grade cutoffs and pass/fail behavior for this course.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[calc(85vh-104px)] overflow-y-auto px-4 py-4 sm:px-6">
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
                  onUpdate={(gradeScale) => updateCourse({ gradeScale })}
                />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );

  if (course.collapsed) {
    const displayGrade = course.isPassFail ? passFailLabel : letterGrade;
    const displayColor = course.isPassFail ? "#6b7280" : gradeColor;
    return (
      <div
        className={`${paperShellClass} overflow-visible ${collapsedPaperRotation} focus-within:z-50 hover:z-20 hover:rotate-0 hover:-translate-y-0.5`}
      >
        <div className="pointer-events-none absolute right-0 top-0 h-10 w-10 bg-primary/8 [clip-path:polygon(100%_0,0_0,100%_100%)]" />
        <div
          className={`${paperTapeClass} left-10 rotate-[-2deg] ${
            course.headerColor ? "opacity-60" : ""
          }`}
        />
        <div className={`${paperTapeClass} right-12 rotate-[3deg]`} />
        {course.headerColor && (
          <div
            className="absolute inset-y-0 left-0 w-2"
            style={{ backgroundColor: course.headerColor }}
          />
        )}
        <CardHeader
          className="cursor-pointer px-4 py-5 sm:px-5"
          onClick={toggleCollapse}
        >
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-white/45 text-foreground/75 transition-all ${
                highlighted
                  ? "animate-pulse border-primary bg-primary/15 text-primary ring-2 ring-primary/35"
                  : "border-primary/20"
              }`}
              title="Expand course"
            >
              <ChevronDown className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 truncate text-lg font-bold text-foreground">
              {course.name || "Untitled"}
            </span>
            {courseCriteria.length === 0 && directGradeEditing ? (
              <input
                type="text"
                inputMode="decimal"
                autoFocus
                value={directGradeDraft}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setDirectGradeDraft(e.target.value)}
                onBlur={commitDirectGrade}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setDirectGradeEditing(false);
                }}
                placeholder="0-100"
                className="w-24 shrink-0 rounded-md border border-primary/30 bg-white/70 px-2.5 py-1 text-sm font-bold tabular-nums text-primary outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                title="Enter final grade"
              />
            ) : courseCriteria.length === 0 ? (
              <button
                type="button"
                className="shrink-0 cursor-text rounded-md border border-primary/20 bg-white/55 px-2.5 py-1 text-sm font-bold tabular-nums text-primary transition-colors hover:border-primary/40 hover:bg-white/75"
                onClick={(e) => {
                  e.stopPropagation();
                  startDirectGradeEdit();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                title="Edit final grade"
              >
                {numericGrade.toFixed(2)}%
              </button>
            ) : (
              <span className="shrink-0 rounded-md border border-primary/20 bg-white/55 px-2.5 py-1 text-sm font-bold tabular-nums text-primary">
                {numericGrade.toFixed(2)}%
              </span>
            )}
            <span
              className="shrink-0 rounded-md border border-primary/20 bg-white/55 px-2.5 py-1 text-lg font-bold leading-none"
              style={{ color: displayColor }}
            >
              {displayGrade}
            </span>
            <span className="shrink-0 rounded-md border border-primary/15 bg-white/45 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              {course.credits || 0} cr
            </span>
            <div
              className="shrink-0"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <HeaderColorPicker
                currentColor={course.headerColor}
                onChange={updateHeaderColor}
                side="top"
              />
            </div>
            <Button
              variant="destructive"
              size="icon"
              className="h-9 w-9 shrink-0 ![box-shadow:none]"
              title="Delete course"
              onClick={(e) => {
                e.stopPropagation();
                requestCourseDelete();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        {deleteConfirmation}
      </div>
    );
  }

  return (
    <div className={`${paperShellClass} overflow-hidden`}>
      <div className="pointer-events-none absolute right-0 top-0 h-12 w-12 bg-primary/8 [clip-path:polygon(100%_0,0_0,100%_100%)]" />
      <div className={`${paperTapeClass} left-12 rotate-[-2deg]`} />
      <div className={`${paperTapeClass} right-16 rotate-[3deg]`} />
      {course.headerColor && (
        <div
          className="absolute inset-y-0 left-0 w-2"
          style={{ backgroundColor: course.headerColor }}
        />
      )}
      <CardHeader className="px-5 pb-4 pt-6">
        <div
          className="relative cursor-pointer rounded-lg border border-primary/20 bg-white/45 p-4 shadow-[3px_4px_0_rgba(198,90,78,0.10)]"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest(interactiveDragSelector)) return;
            toggleCollapse();
          }}
          title="Collapse course"
        >
          <div className="pointer-events-none absolute -top-2 left-8 h-5 w-16 rotate-[-3deg] bg-primary/12" />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleCollapse}
              title="Collapse course"
              className="mt-1.5 h-8 w-8 shrink-0 border border-primary/15 bg-[#fff8f1]/80 p-0"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <div className="flex-1 space-y-3">
              {/* Course name + controls */}
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
                  className="max-w-md border-2 border-primary/20 bg-[#fff8f1] text-lg font-semibold"
                  placeholder="Course Name"
                />
                {onDuplicate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDuplicate}
                    className="gap-2"
                    title="Duplicate course"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Credits + boost */}
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
                    className="w-20 rounded-md border-2 border-primary/20 bg-[#fff8f1]/80 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/50"
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
                      className="w-24 rounded-md border-2 border-primary/20 bg-[#fff8f1]/80 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/50"
                      title="Percent boost applied to the final course grade"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 self-start lg:self-auto">
              <HeaderColorPicker
                currentColor={course.headerColor}
                onChange={updateHeaderColor}
              />
              <Button
                variant="destructive"
                size="icon"
                title="Delete course"
                onClick={requestCourseDelete}
                className="shrink-0 ![box-shadow:none]"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-6 pt-2">
        <div
          className="space-y-4 rounded-lg border border-primary/20 bg-white/35 p-4"
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
            setDropIndicator(null);
          }}
          onDrop={handleDropAtEnd}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-primary">Distribution</h3>
            {courseCriteria.length > 0 && (
              <span
                className={`text-xs font-semibold ${
                  totalWeight === 100 ? "text-primary" : "text-amber-700"
                }`}
              >
                {totalWeight}%{totalWeight !== 100 && " ≠ 100"}
              </span>
            )}
          </div>

          <CourseContext.Provider
            value={{
              gradeScale: course.gradeScale,
              expandedCriteria,
              draggingCriterionId,
              draggingSubItemId,
              draggingSubItemParentId,
              dropIndicator,
              updateCriterion,
              deleteCriterion,
              duplicateCriterion,
              toggleExpanded,
              addSubItem,
              updateSubItem,
              deleteSubItem,
              duplicateSubItem,
              handleDragStart,
              handleDragOver,
              handleDragLeave,
              handleDropOnCriterion,
              handleDragEnd,
              handleSubItemDragStart,
              handleSubItemDragOver,
              handleSubItemDragLeave,
              handleSubItemDrop,
              handleSubItemDragEnd,
            }}
          >
            {courseCriteria.map((criterion) => {
              const criterionKey = criterion.clientId ?? criterion.id;
              return <CriterionRow key={criterionKey} criterion={criterion} />;
            })}
          </CourseContext.Provider>

          {courseCriteria.length > 0 && (
            <div
              className={`flex h-9 items-center justify-center rounded border-2 border-dashed text-xs font-semibold uppercase tracking-widest transition-all ${
                isDraggingGradeItem
                  ? "border-primary/25 bg-primary/5 text-primary/70"
                  : "border-transparent text-transparent"
              } ${
                dropIndicator?.targetId === "__end__"
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : ""
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDropIndicator({ targetId: "__end__", position: "after", intent: "reorder" });
              }}
              onDragLeave={() => {
                if (dropIndicator?.targetId === "__end__") setDropIndicator(null);
              }}
              onDrop={handleDropAtEnd}
            >
              Drop at end
            </div>
          )}

          {courseCriteria.length === 0 && (
            <div className="rounded-lg border-2 border-dashed border-primary/20 bg-[#fff8f1]/70 py-8 text-center text-muted-foreground">
              <p className="text-sm">
                No criteria yet — add one below to start tracking your grade.
              </p>
            </div>
          )}

          <Button
            onClick={addCriterion}
            variant="outline"
            size="sm"
            className="w-full gap-2 border-2 border-dashed border-primary/30 bg-[#fff8f1]/70"
          >
            <Plus className="h-4 w-4" />
            Add Criteria
          </Button>
        </div>

        <div className="relative mt-6 rounded-lg border border-primary/25 bg-white/35 p-6 shadow-[3px_4px_0_rgba(198,90,78,0.10)]">
          <div className="pointer-events-none absolute -top-2 left-1/2 h-5 w-20 -translate-x-1/2 rotate-2 bg-primary/15" />
          {gradeSummary(false)}
        </div>
      </CardContent>
      {deleteConfirmation}
    </div>
  );
}
