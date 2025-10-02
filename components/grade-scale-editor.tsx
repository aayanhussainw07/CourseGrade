"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, X } from "lucide-react"
import type { GradeScale } from "@/lib/types"

interface GradeScaleEditorProps {
  gradeScale: GradeScale[]
  onUpdate: (gradeScale: GradeScale[]) => void
}

export function GradeScaleEditor({ gradeScale, onUpdate }: GradeScaleEditorProps) {
  const addGrade = () => {
    const newGrade: GradeScale = {
      letter: "A+",
      min: 97,
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
                  value={grade.letter}
                  onChange={(e) => updateGrade(originalIndex, { letter: e.target.value })}
                  className="border-primary/20"
                  placeholder="e.g., A, B+, C-"
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Minimum %</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={grade.min}
                  onChange={(e) =>
                    updateGrade(originalIndex, {
                      min: Number.parseFloat(e.target.value) || 0,
                    })
                  }
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
