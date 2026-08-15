"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Plus, X } from "lucide-react"
import { useState, useEffect, useId, useMemo, useRef, useCallback } from "react"
import type { GradeScale } from "@/lib/types"
import { adjustGradeBoundary } from "@/lib/grade-scale"

interface PassFailSettings {
  passLabel: string
  failLabel: string
  threshold: number
}

interface GradeScaleEditorBaseProps {
  gradeScale: GradeScale[]
  onUpdate: (gradeScale: GradeScale[]) => void
}

interface CombinedGradeScaleEditorProps extends GradeScaleEditorBaseProps {
  mode?: "combined"
  isPassFail: boolean
  onPassFailChange: (value: boolean) => void
  passFailSettings: PassFailSettings
  onPassFailSettingsChange: (settings: PassFailSettings) => void
}

interface LetterOnlyGradeScaleEditorProps extends GradeScaleEditorBaseProps {
  mode: "letter-only"
}

type GradeScaleEditorProps =
  | CombinedGradeScaleEditorProps
  | LetterOnlyGradeScaleEditorProps

const clampPercentage = (value: number) => Math.min(100, Math.max(0, value))

const sanitizePassFailSettings = (settings: PassFailSettings): PassFailSettings => ({
  passLabel: settings.passLabel?.trim() || "P",
  failLabel: settings.failLabel?.trim() || "F",
  threshold: clampPercentage(typeof settings.threshold === "number" ? settings.threshold : 60),
})

const normalizeLetter = (value?: string) => (value ? value.trim().toUpperCase() : "")
const normalizeMinimum = (value?: string) => {
  if (!value) return 0
  const parsed = Number.parseFloat(value.trim())
  return Number.isNaN(parsed) ? 0 : Math.max(0, parsed)
}

export function GradeScaleEditor(props: GradeScaleEditorProps) {
  const { gradeScale, onUpdate } = props
  const combinedProps = props.mode === "letter-only" ? null : props
  const isPassFail = combinedProps?.isPassFail ?? false
  const passFailSettings = combinedProps?.passFailSettings ?? {
    passLabel: "P",
    failLabel: "F",
    threshold: 60,
  }
  const [editingValues, setEditingValues] = useState<Record<string, { letter?: string; min?: string }>>({})
  const [dragScale, setDragScale] = useState<GradeScale[] | null>(null)
  const dragScaleRef = useRef<GradeScale[] | null>(null)
  const passFailToggleId = useId()
  const normalizedPassFail = useMemo(() => sanitizePassFailSettings(passFailSettings), [passFailSettings])

  useEffect(() => {
    // Clear editing values when gradeScale changes externally
    setEditingValues({})
  }, [gradeScale])

  const getEditingKey = (index: number) => `${index}`

  useEffect(() => {
    if (!isPassFail) return
    const desiredScale: GradeScale[] = [
      { letter: normalizedPassFail.passLabel, min: normalizedPassFail.threshold },
      { letter: normalizedPassFail.failLabel, min: 0 },
    ]
    const matches =
      gradeScale.length === desiredScale.length &&
      desiredScale.every((target, index) => {
        const current = gradeScale[index]
        return current && current.letter === target.letter && current.min === target.min
      })
    if (!matches) {
      onUpdate(desiredScale)
    }
  }, [gradeScale, isPassFail, normalizedPassFail, onUpdate])

  const getDisplayValue = (index: number, field: "letter" | "min") => {
    const key = getEditingKey(index)
    if (editingValues[key]?.[field] !== undefined) {
      return editingValues[key][field]
    }
    if (field === "min") {
      return (dragScale ?? gradeScale)[index][field].toString()
    }
    return (dragScale ?? gradeScale)[index][field]
  }

  const commitChanges = (index: number) => {
    const key = getEditingKey(index)
    const edits = editingValues[key]
    if (edits) {
      const updates: Partial<GradeScale> = {}
      if (edits.letter !== undefined) {
        updates.letter = normalizeLetter(edits.letter)
      }
      if (edits.min !== undefined) {
        updates.min = normalizeMinimum(edits.min)
      }
      updateGrade(index, updates)
      setEditingValues((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  const addGrade = () => {
    const newGrade: GradeScale = {
      letter: "X",
      min: 100,
    }
    onUpdate([...gradeScale, newGrade])
  }

  const updateGrade = (index: number, updates: Partial<GradeScale>) => {
    const updated = [...gradeScale]
    updated[index] = { ...updated[index], ...updates }
    onUpdate(updated)
  }

  const deleteGrade = (index: number) => {
    onUpdate(gradeScale.filter((_, i) => i !== index))
  }

  const sortedScale = useMemo(
    () =>
      (dragScale ?? gradeScale)
        .map((grade, index) => ({ grade, index }))
        .sort((a, b) => b.grade.min - a.grade.min),
    [dragScale, gradeScale],
  )

  // Ascending (left→right on the bar): lowest min first.
  const ascendingScale = useMemo(
    () =>
      (dragScale ?? gradeScale)
        .map((grade, index) => ({ grade, index }))
        .sort((a, b) => a.grade.min - b.grade.min),
    [dragScale, gradeScale],
  )

  const barRef = useRef<HTMLDivElement>(null)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)

  const startDrag = useCallback(
    (originalIndex: number) => (e: React.PointerEvent) => {
      e.preventDefault()
      const initial = gradeScale.map((grade) => ({ ...grade }))
      dragScaleRef.current = initial
      setDragScale(initial)
      setDraggingIndex(originalIndex)
    },
    [gradeScale],
  )

  useEffect(() => {
    if (draggingIndex === null) return
    const handleMove = (e: PointerEvent) => {
      const rect = barRef.current?.getBoundingClientRect()
      if (!rect || rect.width === 0) return
      const pct = ((e.clientX - rect.left) / rect.width) * 100
      const current = dragScaleRef.current ?? gradeScale
      const next = adjustGradeBoundary(current, draggingIndex, pct)
      dragScaleRef.current = next
      setDragScale(next)
    }
    const handleUp = () => {
      const committed = dragScaleRef.current
      dragScaleRef.current = null
      setDragScale(null)
      setDraggingIndex(null)
      if (
        committed &&
        committed.some(
          (grade, index) =>
            grade.letter !== gradeScale[index]?.letter ||
            grade.min !== gradeScale[index]?.min,
        )
      ) {
        onUpdate(committed)
      }
    }
    const handleCancel = () => {
      dragScaleRef.current = null
      setDragScale(null)
      setDraggingIndex(null)
    }
    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleUp)
    window.addEventListener("pointercancel", handleCancel)
    return () => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
      window.removeEventListener("pointercancel", handleCancel)
    }
  }, [draggingIndex, gradeScale, onUpdate])

  return (
    <div className="space-y-4">
      {combinedProps && (
        <div className="relative space-y-3 overflow-hidden rounded-lg border border-primary/25 bg-[#fff8f1]/70 p-4">
          <div className="pointer-events-none absolute -top-2 right-8 h-5 w-16 rotate-2 bg-primary/12" />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Pass/Fail Mode</p>
              <p className="text-xs text-muted-foreground">
                {isPassFail ? "This course is excluded from GPA calculations." : "This course is included in GPA calculations."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id={passFailToggleId}
                checked={isPassFail}
                onCheckedChange={(checked) => combinedProps.onPassFailChange(checked === true)}
              />
              <Label htmlFor={passFailToggleId} className="text-sm font-medium">
                {isPassFail ? "Enabled" : "Disabled"}
              </Label>
            </div>
          </div>

          {isPassFail && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Pass Label</Label>
                <Input
                  value={passFailSettings.passLabel}
                  onChange={(e) =>
                    combinedProps.onPassFailSettingsChange({
                      ...passFailSettings,
                      passLabel: e.target.value,
                    })
                  }
                  placeholder="P"
                  className="border-2 border-primary/20 bg-[#fff8f1]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Fail Label</Label>
                <Input
                  value={passFailSettings.failLabel}
                  onChange={(e) =>
                    combinedProps.onPassFailSettingsChange({
                      ...passFailSettings,
                      failLabel: e.target.value,
                    })
                  }
                  placeholder="F"
                  className="border-2 border-primary/20 bg-[#fff8f1]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Minimum % to Pass</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={passFailSettings.threshold.toString()}
                  onChange={(e) => {
                    const value = e.target.value.trim() === "" ? 0 : Number.parseFloat(e.target.value)
                    combinedProps.onPassFailSettingsChange({
                      ...passFailSettings,
                      threshold: clampPercentage(Number.isNaN(value) ? 0 : value),
                    })
                  }}
                  className="border-2 border-primary/20 bg-[#fff8f1]"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {isPassFail ? (
        <div className="relative overflow-hidden rounded-lg border border-primary/20 bg-white/45 px-4 py-3 text-sm text-muted-foreground">
          <div className="pointer-events-none absolute -top-2 left-8 h-5 w-16 rotate-[-2deg] bg-primary/12" />
          Letter grades are hidden while pass/fail mode is enabled. The pass label, fail label, and threshold above
          control how scores are interpreted.
        </div>
      ) : (
        <>
          {/* Visual threshold bar */}
          <div className="select-none space-y-1">
            <div
              ref={barRef}
              className="relative h-12 w-full overflow-hidden rounded-lg border-2 border-primary/20 bg-white/45"
            >
              {ascendingScale.map(({ grade, index }, pos) => {
                const upper =
                  pos < ascendingScale.length - 1
                    ? ascendingScale[pos + 1].grade.min
                    : 100
                const width = Math.max(0, upper - grade.min)
                const ratio =
                  ascendingScale.length > 1
                    ? pos / (ascendingScale.length - 1)
                    : 1
                const hue = Math.round(120 * ratio) // red (low) → green (high)
                return (
                  <div
                    key={`seg-${index}`}
                    className="absolute top-0 flex h-full flex-col items-center justify-center overflow-hidden text-center leading-tight"
                    style={{
                      left: `${grade.min}%`,
                      width: `${width}%`,
                      backgroundColor: `hsl(${hue} 50% 73%)`,
                    }}
                  >
                    {width > 7 && (
                      <>
                        <span className="text-xs font-semibold text-foreground/85">
                          {grade.letter}
                        </span>
                        <span className="text-[10px] text-foreground/55">
                          {grade.min}–{upper}
                        </span>
                      </>
                    )}
                  </div>
                )
              })}
              {/* Draggable boundary handles (lowest grade is pinned to 0) */}
              {ascendingScale.map(({ grade, index }, pos) => {
                if (pos === 0) return null
                return (
                  <div
                    key={`handle-${index}`}
                    onPointerDown={startDrag(index)}
                    className="absolute top-0 z-10 h-full w-4 -translate-x-1/2 cursor-ew-resize touch-none"
                    style={{ left: `${grade.min}%` }}
                  >
                    <div className="mx-auto h-full w-0.5 bg-foreground/40" />
                    <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary/40 bg-white" />
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between px-0.5 text-[10px] text-muted-foreground">
              <span>0</span>
              <span>25</span>
              <span>50</span>
              <span>75</span>
              <span>100</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Drag the handles to set cutoffs, or type exact values below.
            </p>
          </div>

          {/* Precise numeric editor */}
          <div className="max-h-72 space-y-2 overflow-y-auto">
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <span>Letter</span>
              <span>Min %</span>
              <span className="w-8" />
            </div>
            {sortedScale.map(({ grade, index }) => {
              const originalIndex = index
              return (
                <div
                  key={`${grade.letter}-${grade.min}-${index}`}
                  className="grid grid-cols-[1fr_1fr_auto] items-center gap-2"
                >
                  <Input
                    value={(getDisplayValue(originalIndex, "letter") as string) ?? ""}
                    onChange={(e) => {
                      const key = getEditingKey(originalIndex)
                      setEditingValues((prev) => ({
                        ...prev,
                        [key]: { ...prev[key], letter: e.target.value },
                      }))
                    }}
                    onBlur={() => commitChanges(originalIndex)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        commitChanges(originalIndex)
                        e.currentTarget.blur()
                      }
                    }}
                    className="h-9 border-2 border-primary/20 bg-[#fff8f1]"
                    placeholder="e.g., A, B+, C-"
                  />
                  <Input
                    type="number"
                    min="0"
                    value={(getDisplayValue(originalIndex, "min") as string) ?? ""}
                    onChange={(e) => {
                      const key = getEditingKey(originalIndex)
                      setEditingValues((prev) => ({
                        ...prev,
                        [key]: { ...prev[key], min: e.target.value },
                      }))
                    }}
                    onBlur={() => commitChanges(originalIndex)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        commitChanges(originalIndex)
                        e.currentTarget.blur()
                      }
                    }}
                    className="h-9 border-2 border-primary/20 bg-[#fff8f1]"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteGrade(originalIndex)}
                    className="h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}
          </div>

          <Button
            onClick={addGrade}
            variant="outline"
            size="sm"
            className="w-full gap-2 border-2 border-dashed border-primary/30 bg-[#fff8f1]/70"
          >
            <Plus className="h-4 w-4" />
            Add Grade
          </Button>
        </>
      )}
    </div>
  )
}
