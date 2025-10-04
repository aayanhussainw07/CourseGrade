"use client"

import type React from "react"
import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, Plus, X, Settings, ChevronDown, ChevronRight, ChevronUp } from "lucide-react"
import { calculateCourseGrade, getLetterGrade, getLetterGradeColor } from "@/lib/grade-utils"
import type { Course, Criterion, SubItem } from "@/lib/types"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { GradeScaleEditor } from "@/components/grade-scale-editor"
import { RollingNumber } from "@/components/rolling-number"

// Props passed into this component: a single course object and functions to update or delete it.
interface CourseCardProps {
  course: Course
  onUpdate: (id: string, course: Course) => void
  onDelete: (id: string) => void
}

// The CourseCard component — displays one course, lets you edit criteria, grade scale, etc.
export function CourseCard({ course, onUpdate, onDelete }: CourseCardProps) {
  // State for whether the grade scale editor dialog is open
  const [isScaleOpen, setIsScaleOpen] = useState(false)
  // State for which criteria are expanded (for showing sub-items like individual assignments)
  const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(new Set())

  // Calculate numeric grade (weighted average) and letter grade
  const numericGrade = calculateCourseGrade(course.criteria)
  const letterGrade = getLetterGrade(numericGrade, course.gradeScale)
  const gradeColor = getLetterGradeColor(letterGrade)

  // Total % weight across all criteria (should add to 100)
  const totalWeight = course.criteria.reduce((sum, c) => sum + c.weight, 0)

  // Toggle collapse/expand for the entire course card
  const toggleCollapse = () => {
    onUpdate(course.id, { ...course, collapsed: !course.collapsed })
  }

  // Update the course name (typing in the title input)
  const updateCourseName = (name: string) => {
    onUpdate(course.id, { ...course, name })
  }

  // Update number of credit hours
  const updateCredits = (value: string) => {
    const credits = value === "" ? 0 : Number.parseFloat(value)
    onUpdate(course.id, { ...course, credits })
  }

  // Add a new grading criterion (like “Assignments” or “Midterm”)
  const addCriterion = () => {
    const newCriterion: Criterion = {
      id: crypto.randomUUID(),
      name: "New Criterion",
      weight: 0,
      score: 0,
    }
    onUpdate(course.id, {
      ...course,
      criteria: [...course.criteria, newCriterion],
    })
  }

  // Update a specific criterion (name, weight, or score)
  const updateCriterion = (id: string, updates: Partial<Criterion>) => {
    onUpdate(course.id, {
      ...course,
      criteria: course.criteria.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })
  }

  // Delete a criterion entirely
  const deleteCriterion = (id: string) => {
    onUpdate(course.id, {
      ...course,
      criteria: course.criteria.filter((c) => c.id !== id),
    })
  }

  // Add a sub-item (like “Homework 1”) under a criterion
  const addSubItem = (criterionId: string) => {
    const criterion = course.criteria.find((c) => c.id === criterionId)
    if (!criterion) return

    const newSubItem: SubItem = {
      id: crypto.randomUUID(),
      name: "Assignment",
      score: 0,
    }

    const subItems = criterion.subItems || []
    updateCriterion(criterionId, {
      subItems: [...subItems, newSubItem],
    })

    // Expand the criterion after adding a sub-item so it’s visible
    setExpandedCriteria((prev) => new Set(prev).add(criterionId))
  }

  // Update a sub-item (name or score)
  const updateSubItem = (criterionId: string, subItemId: string, updates: Partial<SubItem>) => {
    const criterion = course.criteria.find((c) => c.id === criterionId)
    if (!criterion || !criterion.subItems) return

    updateCriterion(criterionId, {
      subItems: criterion.subItems.map((item) => (item.id === subItemId ? { ...item, ...updates } : item)),
    })
  }

  // Delete a sub-item (like removing “Homework 2”)
  const deleteSubItem = (criterionId: string, subItemId: string) => {
    const criterion = course.criteria.find((c) => c.id === criterionId)
    if (!criterion || !criterion.subItems) return

    updateCriterion(criterionId, {
      subItems: criterion.subItems.filter((item) => item.id !== subItemId),
    })
  }

  // Expand or collapse a criterion’s sub-item list
  const toggleExpanded = (criterionId: string) => {
    setExpandedCriteria((prev) => {
      const next = new Set(prev)
      if (next.has(criterionId)) next.delete(criterionId)
      else next.add(criterionId)
      return next
    })
  }

  // Calculate what score to display for a criterion (average of sub-items or its own score)
  const getCriterionDisplayScore = (criterion: Criterion): number => {
    if (criterion.subItems && criterion.subItems.length > 0) {
      const total = criterion.subItems.reduce((sum, item) => sum + item.score, 0)
      return total / criterion.subItems.length
    }
    return criterion.score
  }

  // When focusing on an input, auto-select its content for quick editing
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select()
  }

  return (
    <Card className="border-2 border-primary shadow-lg">
      {/* Course header with title, collapse toggle, delete button, and grade scale editor */}
      <CardHeader className="bg-primary/5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            {/* Editable course name input */}
            <div className="flex items-center gap-3">
              <Input
                value={course.name}
                onChange={(e) => updateCourseName(e.target.value)}
                className="max-w-md border-2 border-primary/20 bg-card text-lg font-semibold"
                placeholder="Course Name"
              />
              {/* Collapse/expand button */}
              <Button variant="outline" size="sm" onClick={toggleCollapse} className="gap-2 bg-transparent">
                {course.collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                {course.collapsed ? "Expand" : "Collapse"}
              </Button>

              {/* Grade scale dialog (only visible when expanded) */}
              {!course.collapsed && (
                <Dialog open={isScaleOpen} onOpenChange={setIsScaleOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                      <Settings className="h-4 w-4" />
                      Grade Scale
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Edit Grade Scale</DialogTitle>
                    </DialogHeader>
                    <GradeScaleEditor
                      gradeScale={course.gradeScale}
                      onUpdate={(gradeScale) => {
                        onUpdate(course.id, { ...course, gradeScale })
                      }}
                    />
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* Credit hours input */}
            <div className="flex items-center gap-2">
              <Label htmlFor={`credits-${course.id}`} className="text-sm font-medium">
                Credit Hours:
              </Label>
              <Input
                id={`credits-${course.id}`}
                type="number"
                min="0"
                max="12"
                step="0.5"
                value={course.credits || ""}
                onChange={(e) => updateCredits(e.target.value)}
                onFocus={handleInputFocus}
                placeholder="0"
                className="w-20 border-2 border-primary/20"
              />
            </div>
          </div>

          {/* Delete course button */}
          <Button variant="destructive" size="icon" onClick={() => onDelete(course.id)} className="shrink-0">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      {/* Full expanded course view */}
      {!course.collapsed && (
        <CardContent className="pt-6">
          {/* Weighted criteria section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-primary">Weighted Criteria</h3>
              <span className={`text-sm font-medium ${totalWeight === 100 ? "text-green-600" : "text-destructive"}`}>
                Total Weight: {totalWeight}%{totalWeight !== 100 && " (should be 100%)"}
              </span>
            </div>

            {/* Render all criteria */}
            {course.criteria.map((criterion) => {
              const hasSubItems = criterion.subItems && criterion.subItems.length > 0
              const isExpanded = expandedCriteria.has(criterion.id)
              const displayScore = getCriterionDisplayScore(criterion)

              return (
                <div key={criterion.id} className="space-y-2">
                  {/* Criterion row */}
                  <div className="grid grid-cols-1 gap-3 rounded-lg border-2 border-primary/20 bg-muted/30 p-4 sm:grid-cols-[2fr_1fr_1fr_auto]">
                    {/* Criterion name */}
                    <div>
                      <Label className="text-xs text-muted-foreground">Name</Label>
                      <Input
                        value={criterion.name}
                        onChange={(e) => updateCriterion(criterion.id, { name: e.target.value })}
                        className="border-primary/20"
                        placeholder="e.g., Assignments"
                      />
                    </div>

                    {/* Criterion weight */}
                    <div>
                      <Label className="text-xs text-muted-foreground">Weight (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={criterion.weight || ""}
                        onChange={(e) =>
                          updateCriterion(criterion.id, {
                            weight: e.target.value === "" ? 0 : Number.parseFloat(e.target.value),
                          })
                        }
                        onFocus={handleInputFocus}
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
                          <RollingNumber value={displayScore} decimals={1} />%
                        </div>
                      ) : (
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={criterion.score || ""}
                          onChange={(e) =>
                            updateCriterion(criterion.id, {
                              score: e.target.value === "" ? 0 : Number.parseFloat(e.target.value),
                            })
                          }
                          onFocus={handleInputFocus}
                          placeholder="0"
                          className="border-primary/20"
                        />
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
                          onClick={() => toggleExpanded(criterion.id)}
                          className="text-muted-foreground hover:bg-muted"
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      )}
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

                  {/* Sub-items section (if expanded) */}
                  {hasSubItems && isExpanded && (
                    <div className="ml-4 space-y-2 border-l-2 border-primary/20 pl-4">
                      {criterion.subItems!.map((subItem) => (
                        <div
                          key={subItem.id}
                          className="grid grid-cols-1 gap-2 rounded-md border border-primary/10 bg-card p-3 sm:grid-cols-[2fr_1fr_auto]"
                        >
                          <div>
                            <Label className="text-xs text-muted-foreground">Name</Label>
                            <Input
                              value={subItem.name}
                              onChange={(e) =>
                                updateSubItem(criterion.id, subItem.id, { name: e.target.value })
                              }
                              className="h-9 border-primary/20"
                              placeholder="e.g., Homework 1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Score (%)</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={subItem.score || ""}
                              onChange={(e) =>
                                updateSubItem(criterion.id, subItem.id, {
                                  score: e.target.value === "" ? 0 : Number.parseFloat(e.target.value),
                                })
                              }
                              onFocus={handleInputFocus}
                              placeholder="0"
                              className="h-9 border-primary/20"
                            />
                          </div>
                          <div className="flex items-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteSubItem(criterion.id, subItem.id)}
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
              )
            })}

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
          <div className="mt-6 rounded-lg border-2 border-primary bg-primary/5 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Course Grade</p>
                <p className="mt-1 text-4xl font-bold text-primary">
                  <RollingNumber value={numericGrade} decimals={2} />%
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-muted-foreground">Letter Grade</p>
                <p className="mt-1 text-5xl font-bold" style={{ color: gradeColor }}>
                  {letterGrade}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      )}

      {/* Compact view when collapsed */}
      {course.collapsed && (
        <CardContent className="pt-4 pb-6">
          <div className="flex items-center justify-between rounded-lg border-2 border-primary bg-primary/5 p-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Course Grade</p>
              <p className="mt-1 text-2xl font-bold text-primary">
                <RollingNumber value={numericGrade} decimals={2} />%
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-muted-foreground">Letter Grade</p>
              <p className="mt-1 text-3xl font-bold" style={{ color: gradeColor }}>
                {letterGrade}
              </p>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
