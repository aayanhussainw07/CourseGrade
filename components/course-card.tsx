"use client";

import type React from "react";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Trash2,
  Plus,
  Settings,
  ChevronDown,
  ChevronUp,
  Download,
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
import { parseScoreInput } from "@/lib/score-input";
import { CriterionRow } from "@/components/course/CriterionRow";
import { CourseColorPicker } from "@/components/course/CourseColorPicker";
import { CourseContext } from "@/components/course/CourseContext";

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
  onExportCourse?: (courseId: string) => void;
  onDuplicate?: () => void;
}

export function CourseCard({
  course,
  highlighted = false,
  onUpdate,
  onDelete,
  onExportCourse,
  onDuplicate,
}: CourseCardProps) {
  const [isScaleOpen, setIsScaleOpen] = useState(false);
  const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(new Set());
  const [nameDraft, setNameDraft] = useState(course.name);
  const formatCreditsDraft = (value: number | null | undefined) => {
    if (value === undefined || value === null || value === 0) return "";
    return value.toString();
  };
  const [creditsDraft, setCreditsDraft] = useState(() => formatCreditsDraft(course.credits));
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
  const [subDropTargetId, setSubDropTargetId] = useState<string | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  const [draggingSubItemId, setDraggingSubItemId] = useState<string | null>(null);
  const [draggingSubItemParentId, setDraggingSubItemParentId] = useState<string | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragOverIdRef = useRef<string | null>(null);
  const [whatIfMode, setWhatIfMode] = useState(false);
  const [whatIfScores, setWhatIfScores] = useState<Record<string, string>>({});
  const [directGradeEditing, setDirectGradeEditing] = useState(false);
  const [directGradeDraft, setDirectGradeDraft] = useState("");
  const interactiveDragSelector =
    "button, input, textarea, select, a[href], [contenteditable='true'], [role='button'], [draggable='false']";

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
    const normalized = Math.round(parsed);
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
    const normalized = Math.max(0, Math.min(100, Number.parseFloat(parsed.toFixed(2))));
    setPercentBoostDraft(normalized.toString());
    if (normalized === (course.percentBoost ?? 0)) return;
    updateCourse({ percentBoost: normalized });
  };

  const updateCardColor = (colorValue: string) => {
    const normalized = colorValue || null;
    if ((course.cardColor ?? null) === normalized) return;
    updateCourse({ cardColor: normalized });
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
      criteria: courseCriteria.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    });
  };

  const moveCriterion = useCallback(
    (
      sourceId: string,
      targetId: string | null,
      position: "before" | "after" = "before",
    ) => {
      if (!sourceId || sourceId === targetId) return;
      const working = [...(Array.isArray(courseCriteria) ? courseCriteria : [])];
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
      subItems: source.subItems?.map((si) => ({ ...si, id: crypto.randomUUID() })),
    };
    const sourceIndex = courseCriteria.findIndex((c) => c.id === id);
    const updated = [...courseCriteria];
    updated.splice(sourceIndex + 1, 0, duplicate);
    updateCourse({ criteria: updated });
  };

  const convertToSubCriterion = (sourceId: string, targetId: string) => {
    const source = courseCriteria.find((c) => c.id === sourceId);
    const target = courseCriteria.find((c) => c.id === targetId);
    if (!source || !target) return;
    const sourceScore =
      source.subItems && source.subItems.length > 0
        ? source.subItems.reduce((sum, si) => sum + si.score, 0) / source.subItems.length
        : source.score;
    const newSubItem: SubItem = { id: crypto.randomUUID(), name: source.name || "Item", score: sourceScore };
    const updatedTarget: Criterion = { ...target, subItems: [...(target.subItems ?? []), newSubItem] };
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
    updateCriterion(criterionId, { subItems: [...(criterion.subItems || []), newSubItem] });
    const expandedKey = criterion.clientId ?? criterion.id;
    setExpandedCriteria((prev) => new Set(prev).add(expandedKey));
  };

  const updateSubItem = (criterionId: string, subItemId: string, updates: Partial<SubItem>) => {
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
    const dupe = { ...source, id: newId, name: source.name ? `${source.name} (copy)` : "" };
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
    const criterionWeight = Number(((subItemWeight * parent.weight) / 100).toFixed(2));
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
    let updated = courseCriteria.map((c) => (c.id === parentCriterionId ? updatedParent : c));
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
    const raw = draggingIdRef.current || event.dataTransfer.getData("text/plain");
    if (!raw) return;
    draggingIdRef.current = null;
    setDraggingSubItemId(null);
    setDraggingSubItemParentId(null);
    if (!raw.startsWith("subitem:")) return;
    const [, srcParentId, srcSubItemId] = raw.split(":");
    if (srcSubItemId === targetSubItemId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const after = event.clientY - rect.top > rect.height / 2;
    if (srcParentId === parentCriterionId) {
      moveSubItemWithinParent(parentCriterionId, srcSubItemId, targetSubItemId, after);
    } else {
      promoteSubItemToCriterion(srcParentId, srcSubItemId, parentCriterionId, after ? "after" : "before");
    }
  };

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, criterionId: string) => {
    const target = event.target as HTMLElement | null;
    if (target && target.closest(interactiveDragSelector)) {
      event.preventDefault();
      return;
    }
    event.stopPropagation();
    draggingIdRef.current = criterionId;
    setDraggingCriterionId(criterionId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", criterionId);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>, targetId: string) => {
    event.preventDefault();
    if (dragOverIdRef.current === targetId) return;
    dragOverIdRef.current = targetId;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setSubDropTargetId(null);
    const sourceId = draggingIdRef.current;
    if (sourceId && !sourceId.startsWith("subitem:") && sourceId !== targetId) {
      hoverTimerRef.current = setTimeout(() => setSubDropTargetId(targetId), 500);
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>, targetId: string) => {
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    if (dragOverIdRef.current === targetId) {
      dragOverIdRef.current = null;
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      setSubDropTargetId(null);
    }
  };

  const handleDropOnCriterion = (event: React.DragEvent<HTMLDivElement>, targetId: string) => {
    event.preventDefault();
    event.stopPropagation();
    const raw = draggingIdRef.current || event.dataTransfer.getData("text/plain");
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
      if (parentId === targetId) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const after = event.clientY - rect.top > rect.height / 2;
      promoteSubItemToCriterion(parentId, subItemId, targetId, after ? "after" : "before");
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
    const raw = draggingIdRef.current || event.dataTransfer.getData("text/plain");
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
        updateCourse({ isPassFail: true, gradeScaleSnapshot: snapshot, gradeScale: passFailScale });
        return;
      }
      const restoredScale = course.gradeScaleSnapshot
        ? cloneGradeScale(course.gradeScaleSnapshot)
        : DEFAULT_GRADE_SCALE.map((grade) => ({ ...grade }));
      updateCourse({ isPassFail: false, gradeScale: restoredScale, gradeScaleSnapshot: undefined });
    },
    [course.gradeScale, course.gradeScaleSnapshot, passFailScale, updateCourse],
  );

  const gradeSummary = (collapsed: boolean) => (
    <div
      className={`flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5/60 ${collapsed ? "p-4" : "p-6"}`}
    >
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
              const normalized = !Number.isNaN(parsed)
                ? Math.min(100, Math.max(0, Number.parseFloat(parsed.toFixed(2))))
                : 0;
              setPercentBoostDraft(normalized > 0 ? String(normalized) : "");
              updateCourse({ percentBoost: normalized });
              setDirectGradeEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setDirectGradeEditing(false);
            }}
            placeholder="0–100"
            className={`mt-1 rounded-md border-2 border-primary/40 bg-transparent px-3 py-1 font-bold text-primary outline-none focus:border-primary ${collapsed ? "w-28 py-0.5 text-2xl px-2" : "w-32 text-3xl"}`}
          />
        ) : (
          <p className={`mt-1 font-bold text-primary ${collapsed ? "text-2xl" : "text-4xl"}`}>
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
      </div>
    </div>
  );

  return (
    <Card
      className={`border-2 shadow-under-white transition-all duration-300 ${highlighted ? "border-primary ring-2 ring-primary/40 ring-offset-2" : "border-primary/35"}`}
      style={cardBackgroundStyle}
    >
      <CardHeader className="">
        <div className="flex items-start justify-between gap-4">
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
                className="max-w-md border-2 border-primary/20 bg-card text-lg font-semibold"
                placeholder="Course Name"
              />
              {course.isPassFail && (
                <Badge className="border border-grey-500/50 bg-grey-100/80 text-grey-900">
                  Pass/Fail
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={toggleCollapse} className="gap-2 bg-card">
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
              <Dialog open={isScaleOpen} onOpenChange={setIsScaleOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 bg-card">
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
                    onUpdate={(gradeScale) => updateCourse({ gradeScale })}
                  />
                </DialogContent>
              </Dialog>
            </div>

            {/* Credits + boost */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor={`credits-${course.id}`} className="text-sm font-medium">
                  Credit:
                </Label>
                <input
                  id={`credits-${course.id}`}
                  type="text"
                  inputMode="decimal"
                  value={creditsDraft}
                  onFocus={() => setCreditsFocused(true)}
                  onChange={(e) => setCreditsDraft(e.target.value)}
                  onBlur={() => { setCreditsFocused(false); commitCredits(); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { setCreditsFocused(false); commitCredits(); e.currentTarget.blur(); }
                  }}
                  placeholder="0"
                  className="w-20 rounded-md border-2 border-primary/20 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/50"
                />
              </div>
              {courseCriteria.length > 0 && (
                <div className="flex items-center gap-2">
                  <Label htmlFor={`boost-${course.id}`} className="text-sm font-medium">
                    Boost (%):
                  </Label>
                  <input
                    id={`boost-${course.id}`}
                    type="text"
                    inputMode="decimal"
                    value={percentBoostDraft}
                    onFocus={() => setPercentBoostFocused(true)}
                    onChange={(e) => setPercentBoostDraft(e.target.value)}
                    onBlur={() => { setPercentBoostFocused(false); commitPercentBoost(); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { setPercentBoostFocused(false); commitPercentBoost(); e.currentTarget.blur(); }
                    }}
                    placeholder="0"
                    className="w-24 rounded-md border-2 border-primary/20 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/50"
                    title="Percent boost applied to the final course grade"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <CourseColorPicker
              currentColor={course.cardColor}
              onChange={updateCardColor}
            />
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
                  for (const c of courseCriteria)
                    initial[c.id] = c.score > 0 ? String(c.score) : "";
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

      <div
        className="grid transition-[grid-template-rows] duration-[220ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ gridTemplateRows: !course.collapsed ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <CardContent className="pt-6">
            <div className="space-y-4" onDragOver={handleDragOver} onDrop={handleDropAtEnd}>
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

              <CourseContext.Provider
                value={{
                  gradeScale: course.gradeScale,
                  whatIfMode,
                  whatIfScores,
                  expandedCriteria,
                  draggingCriterionId,
                  subDropTargetId,
                  draggingSubItemId,
                  setWhatIfScores,
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
                  handleDragEnter,
                  handleDragLeave,
                  handleDropOnCriterion,
                  handleDragEnd,
                  handleSubItemDragStart,
                  handleSubItemDropOnSibling,
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

            <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5/60 p-6">
              {gradeSummary(false)}
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
        </div>
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-150"
        style={{ gridTemplateRows: course.collapsed ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <CardContent className="pt-4 pb-6">
            {gradeSummary(true)}
          </CardContent>
        </div>
      </div>
    </Card>
  );
}
