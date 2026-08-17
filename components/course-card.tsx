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
  Pencil,
  Search,
  Loader2,
  AlertTriangle,
  Check,
} from "lucide-react";
import {
  buildCriterionAdditionUpdate,
  buildPassFailScale,
  calculateCourseGrade,
  cloneGradeScale,
  getLetterGrade,
  getLetterGradeColor,
  isCourseDefault,
} from "@/lib/grade-utils";
import type { Course, Criterion, SubItem } from "@/lib/types";
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
import type { DropIndicator } from "@/components/course/CourseContext";
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

const paperTapeClass =
  "pointer-events-none absolute -top-2 h-5 w-20 bg-primary/15";

interface CourseCardProps {
  course: Course;
  highlighted?: boolean;
  onUpdate: (id: string, course: Course) => void | Promise<void>;
  onDelete: (id: string) => void;
  cornellMode?: boolean;
  skipDeleteConfirm?: boolean;
}

export function CourseCard({
  course,
  highlighted = false,
  onUpdate,
  onDelete,
  cornellMode = false,
  skipDeleteConfirm = false,
}: CourseCardProps) {
  const [isScaleOpen, setIsScaleOpen] = useState(false);
  const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(
    new Set(),
  );
  const [nameDraft, setNameDraft] = useState<string | undefined>(undefined);
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
  const [draggingCriterionId, setDraggingCriterionId] = useState<string | null>(
    null,
  );
  const [draggingSubItemId, setDraggingSubItemId] = useState<string | null>(
    null,
  );
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(
    null,
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const draggingIdRef = useRef<string | null>(null);
  const pointerDropIndicatorRef = useRef<DropIndicator | null>(null);
  const [directGradeEditing, setDirectGradeEditing] = useState(false);
  const [directGradeDraft, setDirectGradeDraft] = useState("");
  const interactiveDragSelector =
    "button, input, textarea, select, a[href], [contenteditable='true'], [role='button']";
  const collapsedPaperRotation =
    COLLAPSED_PAPER_ROTATIONS[
      getStableIndex(course.id, COLLAPSED_PAPER_ROTATIONS.length)
    ];
  const paperShellClass = `relative rounded-xl border-2 bg-[#fff8f1] text-card-foreground backdrop-blur-xl transition-all duration-300 ${
    highlighted && !course.collapsed
      ? "border-primary ring-2 ring-primary/40 ring-offset-2"
      : "border-primary/25"
  }`;

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

  // ── Cornell code-entry autofill ────────────────────────────────────────────
  const [codeDraft, setCodeDraft] = useState("");
  const [lookupState, setLookupState] = useState<
    "idle" | "loading" | "notfound" | "found"
  >("idle");
  const [lookupHint, setLookupHint] = useState<string>("");

  const runCodeLookup = useCallback(async () => {
    const code = codeDraft.trim();
    if (!code) return;
    setLookupState("loading");
    setLookupHint("");
    try {
      const res = await fetch(
        `/api/roster/lookup?code=${encodeURIComponent(code)}`,
      );
      const data = await res.json();
      if (!res.ok || !data.found) {
        setLookupState("notfound");
        return;
      }
      const credits =
        typeof data.creditsMin === "number" ? data.creditsMin : course.credits;
      // Title autofills the name; user can still edit it (custom override).
      updateCourse({ name: data.title ?? course.name, credits });
      const profs: string[] = Array.isArray(data.instructors)
        ? data.instructors
        : [];
      setLookupHint(
        [data.rosterDescr, profs.slice(0, 2).join(", ")]
          .filter(Boolean)
          .join(" · "),
      );
      setLookupState("found");
    } catch {
      setLookupState("notfound");
    }
  }, [codeDraft, course.credits, course.name, updateCourse]);

  const courseCriteria = useMemo(
    () => (Array.isArray(course.criteria) ? course.criteria : []),
    [course.criteria],
  );

  const { numericGrade, letterGrade, gradeColor, totalWeight } = useMemo(() => {
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
  const commitCourseName = () => {
    if (nameDraft === undefined) return;
    setNameDraft(undefined);
    updateCourseName(nameDraft);
  };

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
    if (isCourseDefault(course) || skipDeleteConfirm) {
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
    const isFirstCriterion = courseCriteria.length === 0;
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
    if (isFirstCriterion) {
      setDirectGradeDraft("");
      setDirectGradeEditing(false);
      setPercentBoostDraft("");
    }
    updateCourse(
      buildCriterionAdditionUpdate(
        courseCriteria,
        newCriterion,
        course.percentBoost,
      ),
    );
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

  const clearDragState = () => {
    draggingIdRef.current = null;
    pointerDropIndicatorRef.current = null;
    setDraggingCriterionId(null);
    setDraggingSubItemId(null);
    setDropIndicator(null);
  };

  const setPointerDropIndicator = (indicator: DropIndicator | null) => {
    pointerDropIndicatorRef.current = indicator;
    setDropIndicator(indicator);
  };

  const handlePointerDragStart = (source: {
    criterionId: string;
    subItemId?: string;
  }) => {
    const raw = source.subItemId
      ? `subitem:${source.criterionId}:${source.subItemId}`
      : source.criterionId;
    draggingIdRef.current = raw;
    pointerDropIndicatorRef.current = null;
    setDropIndicator(null);

    if (source.subItemId) {
      setDraggingSubItemId(source.subItemId);
      setDraggingCriterionId(null);
    } else {
      setDraggingCriterionId(source.criterionId);
      setDraggingSubItemId(null);
    }
  };

  const handlePointerDragMove = (clientX: number, clientY: number) => {
    const raw = draggingIdRef.current;
    if (!raw) return;

    const element = document.elementFromPoint(clientX, clientY);
    if (!(element instanceof HTMLElement)) {
      setPointerDropIndicator(null);
      return;
    }

    const endTarget = element.closest<HTMLElement>(
      '[data-grade-drop-kind="end"]',
    );
    if (endTarget) {
      setPointerDropIndicator(
        raw.startsWith("subitem:")
          ? null
          : { targetId: "__end__", position: "after" },
      );
      return;
    }

    const subItemTarget = element.closest<HTMLElement>(
      '[data-grade-drop-kind="subitem"]',
    );
    if (subItemTarget) {
      const parentCriterionId = subItemTarget.dataset.criterionId;
      const subItemId = subItemTarget.dataset.subItemId;
      if (!parentCriterionId || !subItemId) {
        setPointerDropIndicator(null);
        return;
      }

      if (!raw.startsWith("subitem:")) {
        setPointerDropIndicator(null);
        return;
      }

      const [, sourceParentId, sourceSubItemId] = raw.split(":");
      if (
        sourceParentId !== parentCriterionId ||
        sourceSubItemId === subItemId
      ) {
        setPointerDropIndicator(null);
        return;
      }

      const rect = subItemTarget.getBoundingClientRect();
      const position: "before" | "after" =
        (clientY - rect.top) / rect.height < 0.5 ? "before" : "after";
      setPointerDropIndicator({
        targetId: `sub:${parentCriterionId}:${subItemId}`,
        position,
      });
      return;
    }

    const criterionTarget = element.closest<HTMLElement>(
      '[data-grade-drop-kind="criterion"]',
    );
    const targetId = criterionTarget?.dataset.criterionId;
    if (
      !criterionTarget ||
      !targetId ||
      raw === targetId ||
      raw.startsWith("subitem:")
    ) {
      setPointerDropIndicator(null);
      return;
    }

    const rect = criterionTarget.getBoundingClientRect();
    const yRatio = (clientY - rect.top) / rect.height;
    setPointerDropIndicator({
      targetId,
      position: yRatio < 0.5 ? "before" : "after",
    });
  };

  const handlePointerDragEnd = () => {
    const raw = draggingIdRef.current;
    const indicator = pointerDropIndicatorRef.current;
    clearDragState();
    if (!raw || !indicator) return;

    if (indicator.targetId === "__end__") {
      if (!raw.startsWith("subitem:")) {
        moveCriterion(raw, null, "after");
      }
      return;
    }

    if (indicator.targetId.startsWith("sub:")) {
      const [, parentCriterionId, targetSubItemId] =
        indicator.targetId.split(":");
      if (!raw.startsWith("subitem:")) return;

      const [, sourceParentId, sourceSubItemId] = raw.split(":");
      if (
        sourceParentId !== parentCriterionId ||
        sourceSubItemId === targetSubItemId
      )
        return;

      moveSubItemWithinParent(
        parentCriterionId,
        sourceSubItemId,
        targetSubItemId,
        indicator.position === "after",
      );
      return;
    }

    const targetId = indicator.targetId;
    if (!raw.startsWith("subitem:") && raw !== targetId) {
      moveCriterion(raw, targetId, indicator.position);
    }
  };

  const handlePointerDragCancel = () => {
    clearDragState();
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
      className={`flex items-center justify-between rounded-lg bg-[#fff8f1] ${collapsed ? "p-4" : "p-6 sm:p-3"}`}
    >
      <div>
        <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground sm:text-xs">
          Numeric Grade
          {courseCriteria.length === 0 && !directGradeEditing && (
            <button
              type="button"
              onClick={startDirectGradeEdit}
              className="-my-2 ml-0.5 inline-flex h-9 w-9 items-center justify-center rounded text-muted-foreground hover:text-primary transition-colors [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11"
              title="Type your final grade directly"
              aria-label="Type your final grade directly"
            >
              <Pencil className="h-4 w-4" />
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
            className={`mt-1 rounded-md border-2 border-primary/40 bg-transparent px-3 py-1 font-bold text-primary outline-none focus:border-primary ${collapsed ? "w-28 py-0.5 text-2xl px-2" : "w-32 text-3xl sm:mt-0 sm:w-24 sm:text-xl"}`}
          />
        ) : (
          <p
            className={`mt-1 font-bold text-primary ${collapsed ? "text-2xl" : "text-4xl sm:mt-0 sm:text-2xl"}`}
          >
            <RollingNumber value={numericGrade} decimals={2} />%
          </p>
        )}
      </div>
      <div className="text-right sm:flex sm:items-center sm:gap-3">
        <p className="text-sm font-medium text-muted-foreground sm:text-xs">
          {course.isPassFail ? "Pass/Fail" : "Letter Grade"}
        </p>
        <p
          className={`mt-1 font-bold ${collapsed ? "text-3xl" : "text-5xl sm:mt-0 sm:text-3xl"}`}
          style={{ color: course.isPassFail ? "#6b7280" : gradeColor }}
        >
          {course.isPassFail ? passFailLabel : letterGrade}
        </p>
        {!collapsed && (
          <Dialog open={isScaleOpen} onOpenChange={setIsScaleOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 gap-2 sm:mt-0 sm:h-8 sm:px-2"
                title="Edit grade cutoffs and pass/fail"
              >
                <Settings className="h-4 w-4" />
                Grade Scale
              </Button>
            </DialogTrigger>
            <DialogContent
              className="max-h-[85vh] max-w-2xl overflow-hidden border-2 border-primary/25 bg-[#fff8f1] p-0 text-foreground [&]:focus-visible:outline-none [&]:focus-visible:ring-0"
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
          data-course-drag-surface
          className="cursor-pointer px-4 py-5 sm:px-5"
          onClick={toggleCollapse}
        >
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-foreground/75 transition-colors ${
                highlighted
                  ? "animate-pulse text-primary"
                  : ""
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
                className="shrink-0 cursor-text px-2.5 py-1 text-sm font-bold tabular-nums text-primary"
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
              <span className="shrink-0 px-2.5 py-1 text-sm font-bold tabular-nums text-primary">
                {numericGrade.toFixed(2)}%
              </span>
            )}
            <span
              className="shrink-0 px-2.5 py-1 text-lg font-bold leading-none"
              style={{ color: displayColor }}
            >
              {displayGrade}
            </span>
            <span className="shrink-0 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
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
              className="h-9 w-9 shrink-0"
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
      {course.headerColor && (
        <div
          className="absolute inset-y-0 left-0 w-2"
          style={{ backgroundColor: course.headerColor }}
        />
      )}
      <CardHeader className="px-5 pb-4 pt-6 sm:px-4 sm:pb-2 sm:pt-3">
        <div
          data-course-drag-surface
          className="relative cursor-pointer p-4 sm:p-2.5"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest(interactiveDragSelector))
              return;
            toggleCollapse();
          }}
          title="Collapse course"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleCollapse}
              title="Collapse course"
              className="mt-1.5 h-8 w-8 shrink-0 p-0 hover:bg-transparent sm:mt-0"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <div
              className={`min-w-0 flex-1 space-y-2.5 ${
                cornellMode
                  ? ""
                  : "sm:flex sm:items-center sm:gap-3 sm:space-y-0"
              }`}
            >
              {/* Cornell: look up by course code → autofill name/credits */}
              {cornellMode && (
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={codeDraft}
                        onChange={(e) => {
                          setCodeDraft(e.target.value);
                          if (lookupState !== "idle") setLookupState("idle");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            runCodeLookup();
                          }
                        }}
                        placeholder="Course code (e.g. CS 2110)"
                        className="w-56 max-w-full border-2 border-primary/20 bg-[#fff8f1] pl-8 text-sm"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={runCodeLookup}
                      disabled={lookupState === "loading" || !codeDraft.trim()}
                      className="gap-2 border-primary/30 bg-[#fff8f1]"
                    >
                      {lookupState === "loading" && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      )}
                      Autofill
                    </Button>
                  </div>
                  {lookupState === "notfound" && (
                    <p className="text-xs text-destructive">
                      No course found for that code.
                    </p>
                  )}
                  {lookupState === "found" && lookupHint && (
                    <p className="text-xs text-muted-foreground">
                      Filled from {lookupHint}
                    </p>
                  )}
                </div>
              )}
              {/* Course name + controls */}
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                <Input
                  value={nameDraft ?? course.name}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={commitCourseName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitCourseName();
                      const target = e.currentTarget;
                      requestAnimationFrame(() => target.blur());
                    }
                  }}
                  className="max-w-md border-2 border-primary/20 bg-[#fff8f1] text-lg font-semibold sm:h-8 sm:max-w-none sm:flex-1 sm:text-sm"
                  placeholder="Course Name"
                />
              </div>

              {/* Credits */}
              <div className="flex shrink-0 flex-wrap items-center gap-4 sm:gap-3">
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
                    className="w-20 rounded-md border-2 border-primary/20 bg-[#fff8f1]/80 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/50 sm:h-8 sm:w-16 sm:px-2 sm:py-1"
                  />
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <HeaderColorPicker
                currentColor={course.headerColor}
                onChange={updateHeaderColor}
              />
              <Button
                variant="destructive"
                size="icon"
                title="Delete course"
                onClick={requestCourseDelete}
                className="shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-6 pt-2 sm:px-4 sm:pb-4 sm:pt-1">
        <div className="space-y-3 rounded-lg bg-white/25 p-4 sm:space-y-2 sm:p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-primary">Grade Breakdown</h3>
              <Button
                onClick={addCriterion}
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 border-primary/30 bg-[#fff8f1]/70 px-2.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Criteria
              </Button>
            </div>
            {courseCriteria.length > 0 &&
              (totalWeight === 100 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  <Check className="h-3.5 w-3.5" />
                  Weights total 100%
                </span>
              ) : (
                <span
                  role="status"
                  className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold text-white"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Weight total isn't 100%
                </span>
              ))}
          </div>

          <CourseContext.Provider
            value={{
              gradeScale: course.gradeScale,
              expandedCriteria,
              criterionIds: courseCriteria.map((c) => c.id),
              draggingCriterionId,
              draggingSubItemId,
              dropIndicator,
              updateCriterion,
              deleteCriterion,
              toggleExpanded,
              addSubItem,
              updateSubItem,
              deleteSubItem,
              handlePointerDragStart,
              handlePointerDragMove,
              handlePointerDragEnd,
              handlePointerDragCancel,
            }}
          >
            <div className="space-y-1">
              {courseCriteria.map((criterion) => {
                const criterionKey = criterion.clientId ?? criterion.id;
                return (
                  <CriterionRow key={criterionKey} criterion={criterion} />
                );
              })}
            </div>
          </CourseContext.Provider>

          {courseCriteria.length > 0 && draggingCriterionId && (
            <div
              data-grade-drop-kind="end"
              className={`flex h-9 items-center justify-center rounded border-2 border-dashed border-primary/25 bg-primary/5 text-xs font-semibold uppercase tracking-widest text-primary/70 transition-all ${
                dropIndicator?.targetId === "__end__"
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : ""
              }`}
            >
              Drop at end
            </div>
          )}

          {courseCriteria.length > 0 && (
            <div className="flex flex-col gap-2 rounded-md bg-muted/20 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-end sm:px-2 sm:py-2">
              <Label
                htmlFor={`boost-${course.id}`}
                className="text-sm font-medium"
                title="Extra points added to your final course grade (e.g. a 2% participation curve)"
              >
                Course Bonus:
              </Label>
              <div className="flex w-full items-center rounded-md border-2 border-primary/20 bg-[#fff8f1]/80 text-sm focus-within:ring-2 focus-within:ring-primary/50 sm:h-8 sm:w-20">
                <span
                  aria-hidden="true"
                  className="pointer-events-none pl-3 text-muted-foreground sm:pl-2"
                >
                  +
                </span>
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
                  className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none placeholder:text-muted-foreground/60 sm:py-1"
                  title="Extra points added to your final course grade (e.g. a 2% participation curve)"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none pr-3 text-muted-foreground sm:pr-2"
                >
                  %
                </span>
              </div>
            </div>
          )}

          {courseCriteria.length === 0 && (
            <div className="rounded-lg border-2 border-dashed border-primary/20 bg-[#fff8f1]/70 py-8 text-center text-muted-foreground sm:py-4">
              <p className="text-sm">
                No criteria yet — add one to start tracking your grade.
              </p>
            </div>
          )}
        </div>

        <div className="mt-1 rounded-lg bg-white/35 p-5 sm:p-2">
          {gradeSummary(false)}
        </div>
      </CardContent>
      {deleteConfirmation}
    </div>
  );
}
