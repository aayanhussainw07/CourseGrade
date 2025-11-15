"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Plus, X } from "lucide-react"
import { useState, useEffect, useId, useMemo } from "react"
import type { GradeScale } from "@/lib/types"

interface PassFailSettings {
  passLabel: string
  failLabel: string
  threshold: number
}

interface GradeScaleEditorProps {
  gradeScale: GradeScale[]
  onUpdate: (gradeScale: GradeScale[]) => void
  isPassFail: boolean
  onPassFailChange: (value: boolean) => void
  passFailSettings: PassFailSettings
  onPassFailSettingsChange: (settings: PassFailSettings) => void
}

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

export function GradeScaleEditor({
  gradeScale,
  onUpdate,
  isPassFail,
  onPassFailChange,
  passFailSettings,
  onPassFailSettingsChange,
}: GradeScaleEditorProps) {
  const [editingValues, setEditingValues] = useState<Record<string, { letter?: string; min?: string }>>({})
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
      return gradeScale[index][field].toString()
    }
    return gradeScale[index][field]
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
      gradeScale
        .map((grade, index) => ({ grade, index }))
        .sort((a, b) => b.grade.min - a.grade.min),
    [gradeScale],
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Define the minimum percentage required for each letter grade. Grades are automatically sorted by minimum score.
      </p>
      <div className="space-y-3 rounded-lg border border-primary/20 bg-muted/40 p-4">
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
              onCheckedChange={(checked) => onPassFailChange(checked === true)}
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
                  onPassFailSettingsChange({
                    ...passFailSettings,
                    passLabel: e.target.value,
                  })
                }
                placeholder="P"
                className="border-primary/30"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Fail Label</Label>
              <Input
                value={passFailSettings.failLabel}
                onChange={(e) =>
                  onPassFailSettingsChange({
                    ...passFailSettings,
                    failLabel: e.target.value,
                  })
                }
                placeholder="F"
                className="border-primary/30"
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
                  onPassFailSettingsChange({
                    ...passFailSettings,
                    threshold: clampPercentage(Number.isNaN(value) ? 0 : value),
                  })
                }}
                className="border-primary/30"
              />
            </div>
          </div>
        )}
      </div>

      {isPassFail ? (
        <div className="rounded-lg border border-primary/10 bg-card/70 px-4 py-3 text-sm text-muted-foreground">
          Letter grades are hidden while pass/fail mode is enabled. The pass label, fail label, and threshold above
          control how scores are interpreted.
        </div>
      ) : (
        <>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {sortedScale.map(({ grade, index }) => {
              const originalIndex = index
              return (
                <div
                  key={`${grade.letter}-${grade.min}-${index}`}
                  className="flex items-end gap-3 rounded-lg border-2 border-primary/20 bg-muted/30 p-3"
                >
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Letter Grade</Label>
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
                      className="border-primary/20"
                      placeholder="e.g., A, B+, C-"
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Minimum %</Label>
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
                      className="border-primary/20"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteGrade(originalIndex)}
                    className="shrink-0 text-destructive hover:bg-destructive/10"
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
            className="w-full gap-2 border-2 border-dashed border-primary/30 bg-transparent"
          >
            <Plus className="h-4 w-4" />
            Add Grade
          </Button>
        </>
      )}
    </div>
  )
}
