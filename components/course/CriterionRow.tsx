"use client";

import type React from "react";
import { useEffect, useRef, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GripVertical,
  Plus,
  ChevronDown,
  ChevronRight,
  X,
  ArrowRight,
  ArrowLeft,
  IndentDecrease,
} from "lucide-react";
import type { Criterion, SubItem } from "@/lib/types";
import {
  parseDraftNumber,
  parseScoreInput,
  parseFractionOrNumber,
  formatNumberValue,
} from "@/lib/score-input";
import { useCourseContext } from "@/components/course/CourseContext";
import type { DragIntent } from "@/components/course/CourseContext";

type NumericField = "weight" | "score" | "dropLowest" | "extraCredit";

function handleEnterCommit(
  e: React.KeyboardEvent<HTMLInputElement>,
  onCommit?: () => void,
) {
  if (e.key !== "Enter") return;
  e.preventDefault();
  onCommit?.();
  const target = e.currentTarget;
  window.getSelection()?.removeAllRanges();
  requestAnimationFrame(() => target.blur());
}

function DropLine({ intent, position }: { intent: DragIntent; position: "before" | "after" }) {
  const isNest = intent === "nest";
  const isPromote = intent === "promote";
  return (
    <div
      className={`pointer-events-none absolute left-0 right-0 z-10 flex items-center ${
        position === "before" ? "-top-[5px]" : "-bottom-[5px]"
      }`}
    >
      <div
        className={`flex h-[3px] w-full items-center rounded-full ${
          isNest ? "bg-primary ml-8" : isPromote ? "bg-emerald-500" : "bg-primary"
        }`}
      >
        {isNest && (
          <span className="absolute -left-0 flex items-center gap-0.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            <ArrowRight className="h-3 w-3" />
            Nest
          </span>
        )}
        {isPromote && (
          <span className="absolute -left-0 flex items-center gap-0.5 rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            <ArrowLeft className="h-3 w-3" />
            Promote
          </span>
        )}
      </div>
    </div>
  );
}

function SubItemDropLine({
  intent = "reorder",
  position,
}: {
  intent?: Extract<DragIntent, "reorder" | "nest">;
  position: "before" | "after";
}) {
  const isNest = intent === "nest";
  return (
    <div
      className={`pointer-events-none absolute left-0 right-0 z-10 flex items-center ${
        position === "before" ? "-top-[5px]" : "-bottom-[5px]"
      }`}
    >
      <div className={`flex h-[2px] w-full items-center rounded-full ${isNest ? "bg-primary" : "bg-primary"}`}>
        {isNest && (
          <span className="absolute -left-0 flex items-center gap-0.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            <ArrowRight className="h-3 w-3" />
            Nest
          </span>
        )}
      </div>
    </div>
  );
}

export function CriterionRow({ criterion }: { criterion: Criterion }) {
  const {
    gradeScale,
    expandedCriteria,
    criterionIds,
    draggingCriterionId,
    draggingSubItemId,
    draggingSubItemParentId,
    dropIndicator,
    updateCriterion,
    convertToSubCriterion,
    promoteSubItemToCriterion,
    deleteCriterion,
    toggleExpanded,
    addSubItem,
    updateSubItem,
    deleteSubItem,
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
    handlePointerDragStart,
    handlePointerDragMove,
    handlePointerDragEnd,
    handlePointerDragCancel,
  } = useCourseContext();

  const criterionKey = criterion.clientId ?? criterion.id;

  const isDragging = draggingCriterionId === criterion.id;
  const isDraggingAnything = !!(draggingCriterionId || draggingSubItemId);
  const isExpanded = expandedCriteria.has(criterionKey);

  // Position among top-level criteria drives the column labels.
  const criterionIndex = criterionIds.indexOf(criterion.id);
  const isFirstCriterion = criterionIndex <= 0;

  // Column labels render only on the first criterion (desktop) so they read
  // like a single table header; suppressed on later rows to cut the repetition.
  // Mobile (single-column grid) keeps a label per field for clarity.
  const labelCls = isFirstCriterion
    ? "text-xs text-muted-foreground"
    : "text-xs text-muted-foreground sm:sr-only";

  // ≥44px hit area on touch screens, compact on desktop (fault #6).
  // transition-none: the Button base sets `transition-all`, which makes the
  // hover/disabled background *fade*. When a click reorders the row out from
  // under the cursor, that fade lingers and reads as a stuck/glitchy hover —
  // snap instead. select-none stops text selection on rapid clicks.
  const touchTarget =
    "h-9 w-9 sm:h-8 sm:w-8 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11 transition-none select-none";

  // Row actions can shift the list or otherwise mutate this card. Blur them
  // after activation and keep their pointer events out of the drag surface.
  const runControl = (fn: () => void) => (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    fn();
  };
  const stopDragStart = (e: React.PointerEvent<HTMLButtonElement>) =>
    e.stopPropagation();

  // A row is only `draggable` while its grip handle is held. Otherwise the
  // browser blocks text selection inside the row and treats any mousedown as
  // the start of a card move. Arm on grip pointerdown, then disarm and clear
  // pointer focus on release/end so focus-within styling does not linger.
  const [dragArmed, setDragArmed] = useState(false);
  const armDrag = () => setDragArmed(true);
  const disarmDrag = () => {
    setDragArmed(false);
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement &&
      activeElement.hasAttribute("data-grade-drag-grip")
    ) {
      activeElement.blur();
    }
  };

  const dragGripPointerProps = (
    source: { criterionId: string; subItemId?: string },
  ) => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (event.pointerType === "mouse") {
        armDrag();
        return;
      }
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      handlePointerDragStart(source, event.clientX);
    },
    onPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (
        event.pointerType === "mouse" ||
        !event.currentTarget.hasPointerCapture(event.pointerId)
      ) {
        return;
      }
      event.preventDefault();
      handlePointerDragMove(event.clientX, event.clientY);
    },
    onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType === "mouse") {
        disarmDrag();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      handlePointerDragEnd();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      disarmDrag();
    },
    onPointerCancel: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType === "mouse") {
        disarmDrag();
        return;
      }
      handlePointerDragCancel();
      disarmDrag();
    },
  });

  const showDropBefore =
    dropIndicator?.targetId === criterion.id && dropIndicator.position === "before";
  const showDropAfter =
    dropIndicator?.targetId === criterion.id && dropIndicator.position === "after";
  const isNestTarget =
    dropIndicator?.targetId === criterion.id && dropIndicator.intent === "nest";
  const isPromoteTarget =
    dropIndicator?.targetId === criterion.id && dropIndicator.intent === "promote";

  // Local draft state — undefined means "no active edit, show persisted value"
  const [nameDraft, setNameDraft] = useState<string | undefined>(undefined);
  const [weightDraft, setWeightDraft] = useState<string | undefined>(undefined);
  const [scoreDraft, setScoreDraft] = useState<string | undefined>(undefined);
  const [dropLowestDraft, setDropLowestDraft] = useState<string | undefined>(undefined);
  const [extraCreditDraft, setExtraCreditDraft] = useState<string | undefined>(undefined);
  const [subItemNameDrafts, setSubItemNameDrafts] = useState<Record<string, string>>({});
  const [subItemScoreDrafts, setSubItemScoreDrafts] = useState<Record<string, string>>({});
  const [subItemWeightDrafts, setSubItemWeightDrafts] = useState<Record<string, string>>({});

  const prevCriterionRef = useRef(criterion);
  useEffect(() => {
    const prev = prevCriterionRef.current;
    prevCriterionRef.current = criterion;
    if (prev === criterion) return;

    if (prev.score !== criterion.score) setScoreDraft(undefined);
    if (prev.weight !== criterion.weight) setWeightDraft(undefined);
    if (prev.name !== criterion.name) setNameDraft(undefined);
    if (prev.extraCredit !== criterion.extraCredit) setExtraCreditDraft(undefined);
    if (prev.dropLowest !== criterion.dropLowest) setDropLowestDraft(undefined);

    const prevSubs = prev.subItems ?? [];
    const currSubs = criterion.subItems ?? [];
    const changedIds = new Set<string>();
    for (const si of currSubs) {
      const p = prevSubs.find((x) => x.id === si.id);
      if (!p || p.score !== si.score || p.name !== si.name || p.weight !== si.weight) {
        changedIds.add(si.id);
      }
    }
    if (changedIds.size > 0) {
      setSubItemNameDrafts((d) => { const next = { ...d }; for (const id of changedIds) delete next[id]; return next; });
      setSubItemScoreDrafts((d) => { const next = { ...d }; for (const id of changedIds) delete next[id]; return next; });
      setSubItemWeightDrafts((d) => { const next = { ...d }; for (const id of changedIds) delete next[id]; return next; });
    }
  }, [criterion]);

  const hasSubItems = !!(criterion.subItems && criterion.subItems.length > 0);

  const displayScore = useMemo(() => {
    const draftDropParsed = dropLowestDraft !== undefined ? parseDraftNumber(dropLowestDraft) : null;
    const dropSetting =
      draftDropParsed !== null
        ? draftDropParsed
        : dropLowestDraft?.trim() === ""
          ? 0
          : (criterion.dropLowest ?? 0);

    const subItems = criterion.subItems;
    if (subItems && subItems.length > 0) {
      const hasWeights = subItems.some((item) => item.weight !== undefined && item.weight > 0);
      const maxDroppable = Math.max(0, subItems.length - 1);
      const dropCount = Math.min(Math.max(0, Math.floor(dropSetting)), maxDroppable);
      let effectiveItems = subItems.map((item) => ({ score: item.score || 0, weight: item.weight }));
      if (dropCount > 0) {
        effectiveItems = [...effectiveItems].sort((a, b) => a.score - b.score).slice(dropCount);
      }
      if (effectiveItems.length === 0) return 0;
      if (hasWeights) {
        return effectiveItems.reduce((sum, item) => sum + (item.score * (item.weight ?? 0)) / 100, 0);
      }
      return effectiveItems.reduce((sum, item) => sum + item.score, 0) / effectiveItems.length;
    }
    return criterion.score;
  }, [criterion, dropLowestDraft]);

  // Draft helpers
  const getDraft = (field: NumericField): string | undefined => {
    if (field === "weight") return weightDraft;
    if (field === "score") return scoreDraft;
    if (field === "dropLowest") return dropLowestDraft;
    return extraCreditDraft;
  };

  const clearDraft = (field: NumericField) => {
    if (field === "weight") setWeightDraft(undefined);
    else if (field === "score") setScoreDraft(undefined);
    else if (field === "dropLowest") setDropLowestDraft(undefined);
    else setExtraCreditDraft(undefined);
  };

  const setDraft = (field: NumericField, value: string) => {
    if (field === "weight") setWeightDraft(value);
    else if (field === "score") setScoreDraft(value);
    else if (field === "dropLowest") setDropLowestDraft(value);
    else setExtraCreditDraft(value);
  };

  const getInputValue = (field: NumericField): string => {
    const draft = getDraft(field);
    if (draft !== undefined) return draft;
    switch (field) {
      case "weight": return formatNumberValue(criterion.weight);
      case "score": return formatNumberValue(criterion.score);
      case "dropLowest": return formatNumberValue(criterion.dropLowest);
      case "extraCredit": return formatNumberValue(criterion.extraCredit);
    }
  };

  const commitName = () => {
    if (nameDraft === undefined) return;
    const trimmed = nameDraft.trim();
    setNameDraft(undefined);
    const nextName = trimmed.length > 0 ? trimmed : "";
    if (nextName === criterion.name) return;
    updateCriterion(criterion.id, { name: nextName });
  };

  const commitField = (field: NumericField) => {
    const draft = getDraft(field);
    if (draft === undefined) return;

    const parsed =
      field === "score"
        ? parseScoreInput(draft, gradeScale)
        : field === "dropLowest"
          ? parseDraftNumber(draft)
          : parseFractionOrNumber(draft);

    const safeValue = parsed ?? 0;
    const normalized = Math.max(0, Number.parseFloat(safeValue.toFixed(2)));
    clearDraft(field);

    if (field === "dropLowest") {
      const maxDroppable = Math.max(0, (criterion.subItems?.length ?? 0) - 1);
      updateCriterion(criterion.id, { dropLowest: Math.min(maxDroppable, Math.floor(normalized)) });
      return;
    }
    updateCriterion(criterion.id, { [field]: normalized });
  };

  // Sub-item helpers
  const getSubItemScoreValue = (subItem: SubItem): string =>
    subItemScoreDrafts[subItem.id] ?? formatNumberValue(subItem.score);

  const getSubItemNameValue = (subItem: SubItem): string =>
    subItemNameDrafts[subItem.id] ?? subItem.name;

  const getSubItemWeightValue = (subItem: SubItem): string => {
    const d = subItemWeightDrafts[subItem.id];
    if (d !== undefined) return d;
    return subItem.weight !== undefined && subItem.weight > 0
      ? subItem.weight.toString()
      : "";
  };

  const commitSubItemScore = (subItemId: string) => {
    const draft = subItemScoreDrafts[subItemId];
    if (draft === undefined) return;
    const parsed = parseScoreInput(draft, gradeScale);
    updateSubItem(criterion.id, subItemId, { score: Math.max(0, parsed ?? 0) });
    setSubItemScoreDrafts((prev) => { const next = { ...prev }; delete next[subItemId]; return next; });
  };

  const commitSubItemName = (subItemId: string) => {
    const draft = subItemNameDrafts[subItemId];
    if (draft === undefined) return;
    updateSubItem(criterion.id, subItemId, { name: draft });
    setSubItemNameDrafts((prev) => { const next = { ...prev }; delete next[subItemId]; return next; });
  };

  const commitSubItemWeight = (subItem: SubItem) => {
    const draft = subItemWeightDrafts[subItem.id];
    if (draft === undefined) return;
    const parsed = parseFractionOrNumber(draft);
    const value =
      parsed !== null
        ? Math.max(0, Math.min(100, Number.parseFloat(parsed.toFixed(2))))
        : 0;
    updateSubItem(criterion.id, subItem.id, { weight: value || undefined });
    setSubItemWeightDrafts((prev) => { const next = { ...prev }; delete next[subItem.id]; return next; });
  };

  return (
    <div className="relative space-y-2">
      {/* Drop indicator: before */}
      {showDropBefore && !isDragging && (
        <DropLine intent={dropIndicator!.intent} position="before" />
      )}

      {/* Criterion row */}
      <div
        className={`group/criterion relative flex items-start gap-2 rounded-md px-2.5 py-2.5 transition-all duration-150 sm:px-1.5 sm:py-1 ${
          isDragging
            ? "scale-[0.97] bg-primary/5 opacity-50 ring-1 ring-primary/40"
            : isNestTarget
              ? "bg-primary/10 ring-1 ring-primary/30"
              : isPromoteTarget
                ? "bg-emerald-50/50 ring-1 ring-emerald-400/25"
              : isDraggingAnything
                ? "bg-muted/10"
                : "bg-muted/20"
        }`}
        data-grade-drop-kind="criterion"
        data-criterion-id={criterion.id}
        draggable={dragArmed}
        onDragStart={(e) => handleDragStart(e, criterion.id)}
        onDragOver={(e) => handleDragOver(e, criterion.id)}
        onDragLeave={(e) => handleDragLeave(e, criterion.id)}
        onDrop={(e) => handleDropOnCriterion(e, criterion.id)}
        onDragEnd={() => {
          handleDragEnd();
          disarmDrag();
        }}
      >
        {/* Nest target label — pinned to the left edge, vertical, so it
            stays visible while the dragged row covers the card center */}
        {isNestTarget && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-start rounded-lg bg-primary/10">
            <span className="ml-2 mt-2 flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
              <ArrowRight className="h-3.5 w-3.5" />
              Nest as sub-item
            </span>
          </div>
        )}
        {isPromoteTarget && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-emerald-500/10">
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
              <ArrowLeft className="h-3.5 w-3.5" />
              Promote to criterion
            </span>
          </div>
        )}

        {/* Drag-only reorder control for mouse, touch, and pen input. */}
        <div
          className={`flex shrink-0 items-center justify-center ${
            isFirstCriterion ? "sm:mt-4" : ""
          }`}
        >
          <button
            type="button"
            data-grade-drag-grip
            aria-label="Drag to move criterion"
            title="Drag to move criterion"
            className={`${touchTarget} touch-none cursor-grab rounded-md text-muted-foreground/45 opacity-0 transition-[opacity,color,background-color] group-hover/criterion:opacity-100 group-focus-within/criterion:opacity-100 hover:bg-muted hover:text-muted-foreground active:cursor-grabbing [@media(pointer:coarse)]:opacity-100 ${isDragging ? "opacity-100" : ""}`}
            {...dragGripPointerProps({ criterionId: criterion.id })}
          >
            <GripVertical className="mx-auto h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Fields grid */}
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] sm:gap-2">
          {/* Name */}
          <div>
            <Label className={labelCls}>Name</Label>
            <Input
              value={nameDraft ?? criterion.name ?? ""}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => handleEnterCommit(e, commitName)}
              className="border-primary/20 sm:h-8 sm:px-2"
              placeholder="e.g., Assignments"
            />
          </div>

          {/* Weight */}
          <div>
            <Label className={labelCls}>Weight (%)</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={getInputValue("weight")}
              onChange={(e) => setDraft("weight", e.target.value)}
              onBlur={() => commitField("weight")}
              onKeyDown={(e) => handleEnterCommit(e, () => commitField("weight"))}
              placeholder="0"
              className="border-primary/20 sm:h-8 sm:px-2"
            />
          </div>

          {/* Score / Avg */}
          <div>
            <Label className={labelCls}>
              {hasSubItems ? "Avg Score (%)" : "Score (%)"}
            </Label>
            {hasSubItems ? (
              <div className="flex h-9 items-center rounded-md border-2 border-primary/20 bg-muted px-3 text-sm font-medium sm:h-8 sm:px-2">
                {displayScore.toFixed(1)}%
              </div>
            ) : (
              <Input
                type="text"
                inputMode="decimal"
                value={getInputValue("score")}
                onChange={(e) => setDraft("score", e.target.value)}
                onBlur={() => commitField("score")}
                onKeyDown={(e) => handleEnterCommit(e, () => commitField("score"))}
                placeholder="0"
                className="border-primary/20 sm:h-8 sm:px-2"
              />
            )}
          </div>

          {/* Extra Credit */}
          <div>
            <Label className={labelCls}>Extra Credit (%)</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={getInputValue("extraCredit")}
              onChange={(e) => setDraft("extraCredit", e.target.value)}
              onBlur={() => commitField("extraCredit")}
              onKeyDown={(e) => handleEnterCommit(e, () => commitField("extraCredit"))}
              placeholder="0"
              className="border-primary/20 sm:h-8 sm:px-2"
              title="Adds to this criterion before weighting"
            />
          </div>

          {/* Drop Lowest (only with sub-items) */}
          <div>
            {hasSubItems ? (
              <>
                <Label className={labelCls}>Drop Lowest</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={getInputValue("dropLowest")}
                  onChange={(e) => setDraft("dropLowest", e.target.value)}
                  onBlur={() => commitField("dropLowest")}
                  onKeyDown={(e) => handleEnterCommit(e, () => commitField("dropLowest"))}
                  placeholder="0"
                  className="border-primary/20 sm:h-8 sm:px-2"
                  title="Number of lowest scores to drop"
                />
              </>
            ) : (
              <div className="h-9 sm:h-8" />
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-end gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => addSubItem(criterion.id)}
              onPointerDown={stopDragStart}
              className={`${touchTarget} text-primary hover:bg-primary/10`}
              title="Add sub-item"
              aria-label="Add sub-item"
            >
              <Plus className="h-4 w-4" />
            </Button>
            {hasSubItems && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => toggleExpanded(criterionKey)}
                onPointerDown={stopDragStart}
                className={`${touchTarget} text-muted-foreground hover:bg-muted`}
                title={isExpanded ? "Collapse sub-items" : "Expand sub-items"}
                aria-label={isExpanded ? "Collapse sub-items" : "Expand sub-items"}
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
              onClick={() => deleteCriterion(criterion.id)}
              onPointerDown={stopDragStart}
              className={`${touchTarget} text-destructive hover:bg-destructive/10`}
              title="Delete criterion"
              aria-label="Delete criterion"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Drop indicator: after (only when no sub-items expanded, otherwise it goes between criterion and sub-items) */}
      {showDropAfter && !isDragging && !isNestTarget && !(hasSubItems && isExpanded) && (
        <DropLine intent={dropIndicator!.intent} position="after" />
      )}

      {/* Sub-items */}
      {hasSubItems && isExpanded && (
        <div className="ml-4 space-y-2 border-l-2 border-primary/20 pl-4">
          {criterion.subItems!.map((subItem) => {
            const promoteSub = () =>
              promoteSubItemToCriterion(
                criterion.id,
                subItem.id,
                criterion.id,
                "after",
              );
            const isSubDragging = draggingSubItemId === subItem.id;
            const subIndicatorId = `sub:${criterion.id}:${subItem.id}`;
            const showSubBefore = dropIndicator?.targetId === subIndicatorId && dropIndicator.position === "before";
            const showSubAfter = dropIndicator?.targetId === subIndicatorId && dropIndicator.position === "after";
            const isPromoteTarget = dropIndicator?.targetId === subIndicatorId && dropIndicator.intent === "promote";
            const isNestSubTarget = dropIndicator?.targetId === subIndicatorId && dropIndicator.intent === "nest";

            return (
              <div key={subItem.id} className="relative">
                {showSubBefore && !isSubDragging && (
                  isPromoteTarget ? (
                    <div className="pointer-events-none absolute -top-[5px] -left-6 right-0 z-10 flex items-center">
                      <div className="flex h-[3px] w-[calc(100%+1.5rem)] items-center rounded-full bg-emerald-500">
                        <span className="absolute -left-0 flex items-center gap-0.5 rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                          <ArrowLeft className="h-3 w-3" />
                          Promote
                        </span>
                      </div>
                    </div>
                  ) : (
                    <SubItemDropLine
                      intent={isNestSubTarget ? "nest" : "reorder"}
                      position="before"
                    />
                  )
                )}

                <div
                  data-grade-drop-kind="subitem"
                  data-criterion-id={criterion.id}
                  data-sub-item-id={subItem.id}
                  draggable={dragArmed}
                  onDragStart={(e) => handleSubItemDragStart(e, criterion.id, subItem.id)}
                  onDragOver={(e) => handleSubItemDragOver(e, criterion.id, subItem.id)}
                  onDragLeave={(e) => handleSubItemDragLeave(e, criterion.id, subItem.id)}
                  onDrop={(e) => handleSubItemDrop(e, criterion.id, subItem.id)}
                  onDragEnd={() => {
                    handleSubItemDragEnd();
                    disarmDrag();
                  }}
                  className={`group/subitem grid grid-cols-1 gap-2 rounded-md p-3 transition-all duration-150 sm:grid-cols-[auto_2fr_1fr_1fr_auto] sm:p-2 ${
                    isSubDragging
                      ? "scale-[0.97] bg-primary/5 opacity-50 ring-1 ring-primary/40"
                      : isNestSubTarget
                        ? "bg-primary/10 ring-1 ring-primary/30"
                      : isPromoteTarget
                        ? "bg-emerald-50/40 ring-1 ring-emerald-400/30"
                        : "bg-card"
                  }`}
                >
                  <div className="flex items-center justify-center sm:pt-3">
                    <button
                      type="button"
                      data-grade-drag-grip
                      aria-label="Drag to move sub-item"
                      title="Drag to move sub-item"
                      className={`${touchTarget} touch-none cursor-grab rounded-md text-muted-foreground/45 opacity-0 transition-[opacity,color,background-color] group-hover/subitem:opacity-100 group-focus-within/subitem:opacity-100 hover:bg-muted hover:text-muted-foreground active:cursor-grabbing [@media(pointer:coarse)]:opacity-100 ${isSubDragging ? "opacity-100" : ""}`}
                      {...dragGripPointerProps({
                        criterionId: criterion.id,
                        subItemId: subItem.id,
                      })}
                    >
                      <GripVertical className="mx-auto h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Name</Label>
                    <Input
                      value={getSubItemNameValue(subItem)}
                      onChange={(e) =>
                        setSubItemNameDrafts((prev) => ({ ...prev, [subItem.id]: e.target.value }))
                      }
                      onBlur={() => commitSubItemName(subItem.id)}
                      onKeyDown={(e) => handleEnterCommit(e, () => commitSubItemName(subItem.id))}
                      className="h-9 border-primary/20 sm:h-8 sm:px-2"
                      placeholder="e.g., Homework 1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Score (%)</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={getSubItemScoreValue(subItem)}
                      onChange={(e) =>
                        setSubItemScoreDrafts((prev) => ({ ...prev, [subItem.id]: e.target.value }))
                      }
                      onBlur={() => commitSubItemScore(subItem.id)}
                      onKeyDown={(e) => handleEnterCommit(e, () => commitSubItemScore(subItem.id))}
                      placeholder="0"
                      className="h-9 border-primary/20 sm:h-8 sm:px-2"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Weight (%)</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={getSubItemWeightValue(subItem)}
                      onChange={(e) =>
                        setSubItemWeightDrafts((prev) => ({ ...prev, [subItem.id]: e.target.value }))
                      }
                      onBlur={() => commitSubItemWeight(subItem)}
                      onKeyDown={(e) => handleEnterCommit(e, () => commitSubItemWeight(subItem))}
                      placeholder="equal"
                      className="h-9 border-primary/20 sm:h-8 sm:px-2"
                      title="Weight of this sub-item (100% = full criterion weight)"
                    />
                  </div>
                  <div className="flex flex-wrap items-end gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={runControl(promoteSub)}
                      onPointerDown={stopDragStart}
                      className={`${touchTarget} text-muted-foreground hover:bg-muted hover:text-foreground`}
                      title="Promote to its own criterion"
                      aria-label="Promote to its own criterion"
                    >
                      <IndentDecrease className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteSubItem(criterion.id, subItem.id)}
                      onPointerDown={stopDragStart}
                      className={`${touchTarget} text-destructive hover:bg-destructive/10`}
                      title="Delete sub-item"
                      aria-label="Delete sub-item"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {showSubAfter && !isSubDragging && (
                  isPromoteTarget ? (
                    <div className="pointer-events-none absolute -bottom-[5px] -left-6 right-0 z-10 flex items-center">
                      <div className="flex h-[3px] w-[calc(100%+1.5rem)] items-center rounded-full bg-emerald-500">
                        <span className="absolute -left-0 flex items-center gap-0.5 rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                          <ArrowLeft className="h-3 w-3" />
                          Promote
                        </span>
                      </div>
                    </div>
                  ) : (
                    <SubItemDropLine
                      intent={isNestSubTarget ? "nest" : "reorder"}
                      position="after"
                    />
                  )
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Drop indicator: after when sub-items are expanded */}
      {showDropAfter && !isDragging && !isNestTarget && hasSubItems && isExpanded && (
        <DropLine intent={dropIndicator!.intent} position="after" />
      )}
    </div>
  );
}
