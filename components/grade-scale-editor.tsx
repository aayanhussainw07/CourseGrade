"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, X } from "lucide-react"
import { useState, useEffect } from "react"
import type { GradeScale } from "@/lib/types"

interface GradeScaleEditorProps {
  gradeScale: GradeScale[]
  onUpdate: (gradeScale: GradeScale[]) => void
}

export function GradeScaleEditor({ gradeScale, onUpdate }: GradeScaleEditorProps) {
  const [editingValues, setEditingValues] = useState<Record<string, { letter?: string; min?: string }>>({})

  useEffect(() => {
    // Clear editing values when gradeScale changes externally
    setEditingValues({})
  }, [gradeScale])

  const getEditingKey = (index: number) => `${index}`

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
        updates.letter = edits.letter.trim().toUpperCase()
      }
      if (edits.min !== undefined) {
        const trimmed = edits.min.trim()
        const normalized = trimmed === "" ? 0 : Number.parseFloat(trimmed)
        updates.min = Number.isNaN(normalized) ? 0 : normalized
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

  const sortedScale = [...gradeScale].sort((a, b) => b.min - a.min)

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Define the minimum percentage required for each letter grade. Grades are automatically sorted by minimum score.
      </p>

      <div className="max-h-96 space-y-2 overflow-y-auto">
        {sortedScale.map((grade, index) => {
          const originalIndex = gradeScale.findIndex((g) => g.letter === grade.letter && g.min === grade.min)
          return (
            <div
              key={`${grade.letter}-${grade.min}`}
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
                    if (e.key === 'Enter') {
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
                    if (e.key === 'Enter') {
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
    </div>
  )
}
