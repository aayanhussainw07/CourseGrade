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
  Copy,
  X,
} from "lucide-react";
import type { Criterion, SubItem, GradeScale } from "@/lib/types";
import {
  parseDraftNumber,
  parseScoreInput,
  parseFractionOrNumber,
  formatNumberValue,
} from "@/lib/score-input";

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
  // rAF lets React flush the draft-clear state update before blur fires,
  // preventing the onBlur handler from seeing stale draft state and double-committing.
  requestAnimationFrame(() => target.blur());
}

interface CriterionRowProps {
  criterion: Criterion;
  gradeScale: GradeScale[];
  isDragging: boolean;
  isSubDropTarget: boolean;
  isExpanded: boolean;
  whatIfMode: boolean;
  whatIfScore: string | undefined;
  draggingSubItemId: string | null;
  onUpdate: (updates: Partial<Criterion>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleExpanded: () => void;
  onWhatIfChange: (value: string) => void;
  onWhatIfBlur: () => void;
  onAddSubItem: () => void;
  onUpdateSubItem: (subItemId: string, updates: Partial<SubItem>) => void;
  onDeleteSubItem: (subItemId: string) => void;
  onDuplicateSubItem: (subItemId: string) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnter: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onSubItemDragStart: (e: React.DragEvent<HTMLDivElement>, subItemId: string) => void;
  onSubItemDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onSubItemDrop: (e: React.DragEvent<HTMLDivElement>, targetSubItemId: string) => void;
  onSubItemDragEnd: () => void;
}

export function CriterionRow({
  criterion,
  gradeScale,
  isDragging,
  isSubDropTarget,
  isExpanded,
  whatIfMode,
  whatIfScore,
  draggingSubItemId,
  onUpdate,
  onDelete,
  onDuplicate,
  onToggleExpanded,
  onWhatIfChange,
  onWhatIfBlur,
  onAddSubItem,
  onUpdateSubItem,
  onDeleteSubItem,
  onDuplicateSubItem,
  onDragStart,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  onDragEnd,
  onSubItemDragStart,
  onSubItemDragOver,
  onSubItemDrop,
  onSubItemDragEnd,
}: CriterionRowProps) {
  // Local draft state — undefined means "no active edit, show persisted value"
  const [nameDraft, setNameDraft] = useState<string | undefined>(undefined);
  const [weightDraft, setWeightDraft] = useState<string | undefined>(undefined);
  const [scoreDraft, setScoreDraft] = useState<string | undefined>(undefined);
  const [dropLowestDraft, setDropLowestDraft] = useState<string | undefined>(undefined);
  const [extraCreditDraft, setExtraCreditDraft] = useState<string | undefined>(undefined);
  const [subItemNameDrafts, setSubItemNameDrafts] = useState<Record<string, string>>({});
  const [subItemScoreDrafts, setSubItemScoreDrafts] = useState<Record<string, string>>({});
  const [subItemWeightDrafts, setSubItemWeightDrafts] = useState<Record<string, string>>({});

  // Clear stale drafts when criterion is updated externally (e.g. by the AI)
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
    onUpdate({ name: nextName });
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
      onUpdate({ dropLowest: Math.min(maxDroppable, Math.floor(normalized)) });
      return;
    }
    onUpdate({ [field]: normalized });
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
    onUpdateSubItem(subItemId, { score: Math.max(0, parsed ?? 0) });
    setSubItemScoreDrafts((prev) => { const next = { ...prev }; delete next[subItemId]; return next; });
  };

  const commitSubItemName = (subItemId: string) => {
    const draft = subItemNameDrafts[subItemId];
    if (draft === undefined) return;
    onUpdateSubItem(subItemId, { name: draft });
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
    onUpdateSubItem(subItem.id, { weight: value || undefined });
    setSubItemWeightDrafts((prev) => { const next = { ...prev }; delete next[subItem.id]; return next; });
  };

  return (
    <div className="space-y-2">
      {/* Criterion row */}
      <div
        className={`relative flex items-start gap-2 rounded-lg border-2 pt-3 px-3 pb-5 transition-all ${
          isDragging
            ? "border-primary/20 bg-muted/30 opacity-40"
            : isSubDropTarget
              ? "border-dashed border-red-500 bg-red-500/5"
              : "border-primary/20 bg-muted/30"
        }`}
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
      >
        {/* Drag handle */}
        <div className="mt-6 flex shrink-0 cursor-grab items-center active:cursor-grabbing">
          <GripVertical className="h-4 w-4 text-muted-foreground/40 transition-colors hover:text-muted-foreground" />
        </div>

        {/* Fields grid */}
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]">
          {/* Name */}
          <div>
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input
              value={nameDraft ?? criterion.name ?? ""}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => handleEnterCommit(e, commitName)}
              className="border-primary/20"
              placeholder="e.g., Assignments"
            />
          </div>

          {/* Weight */}
          <div>
            <Label className="text-xs text-muted-foreground">Weight (%)</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={getInputValue("weight")}
              onChange={(e) => setDraft("weight", e.target.value)}
              onBlur={() => commitField("weight")}
              onKeyDown={(e) => handleEnterCommit(e, () => commitField("weight"))}
              placeholder="0"
              className="border-primary/20"
            />
          </div>

          {/* Score / Avg */}
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
                value={getInputValue("score")}
                onChange={(e) => setDraft("score", e.target.value)}
                onBlur={() => commitField("score")}
                onKeyDown={(e) => handleEnterCommit(e, () => commitField("score"))}
                placeholder="0"
                className="border-primary/20"
              />
            )}
          </div>

          {/* What-If */}
          {whatIfMode && (
            <div>
              <Label className="text-xs font-semibold text-primary/80">What-If (%)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={whatIfScore ?? ""}
                onChange={(e) => onWhatIfChange(e.target.value)}
                onBlur={onWhatIfBlur}
                placeholder={String(criterion.score || 0)}
                className="border-primary/50 bg-primary/5"
              />
            </div>
          )}

          {/* Extra Credit */}
          <div>
            <Label className="text-xs text-muted-foreground">Extra Credit (%)</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={getInputValue("extraCredit")}
              onChange={(e) => setDraft("extraCredit", e.target.value)}
              onBlur={() => commitField("extraCredit")}
              onKeyDown={(e) => handleEnterCommit(e, () => commitField("extraCredit"))}
              placeholder="0"
              className="border-primary/20"
              title="Adds to this criterion before weighting"
            />
          </div>

          {/* Drop Lowest (only with sub-items) */}
          <div>
            {hasSubItems ? (
              <>
                <Label className="text-xs text-muted-foreground">Drop Lowest</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={getInputValue("dropLowest")}
                  onChange={(e) => setDraft("dropLowest", e.target.value)}
                  onBlur={() => commitField("dropLowest")}
                  onKeyDown={(e) => handleEnterCommit(e, () => commitField("dropLowest"))}
                  placeholder="0"
                  className="border-primary/20"
                  title="Number of lowest scores to drop"
                />
              </>
            ) : (
              <div className="h-10" />
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onAddSubItem}
              className="text-primary hover:bg-primary/10"
              title="Add sub-item"
            >
              <Plus className="h-4 w-4" />
            </Button>
            {hasSubItems && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleExpanded}
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
              onClick={onDuplicate}
              className="text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Duplicate criterion"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="text-destructive hover:bg-destructive/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Sub-items */}
      {hasSubItems && isExpanded && (
        <div className="ml-4 space-y-2 border-l-2 border-primary/20 pl-4">
          {criterion.subItems!.map((subItem) => (
            <div
              key={subItem.id}
              draggable
              onDragStart={(e) => onSubItemDragStart(e, subItem.id)}
              onDragOver={onSubItemDragOver}
              onDrop={(e) => onSubItemDrop(e, subItem.id)}
              onDragEnd={onSubItemDragEnd}
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
                <Label className="text-xs text-muted-foreground">Name</Label>
                <Input
                  value={getSubItemNameValue(subItem)}
                  onChange={(e) =>
                    setSubItemNameDrafts((prev) => ({ ...prev, [subItem.id]: e.target.value }))
                  }
                  onBlur={() => commitSubItemName(subItem.id)}
                  onKeyDown={(e) => handleEnterCommit(e, () => commitSubItemName(subItem.id))}
                  className="h-9 border-primary/20"
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
                  className="h-9 border-primary/20"
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
                  className="h-9 border-primary/20"
                  title="Weight of this sub-item (100% = full criterion weight)"
                />
              </div>
              <div className="flex items-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDuplicateSubItem(subItem.id)}
                  className="h-9 w-9 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Duplicate sub-item"
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDeleteSubItem(subItem.id)}
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
}
