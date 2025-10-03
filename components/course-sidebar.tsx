"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog"
import { calculateCourseGrade, getLetterGrade, getLetterGradeColor } from "@/lib/grade-utils"
import type { Semester } from "@/lib/types"
import { BookOpen, ChevronLeft, ChevronRight, Plus, Edit2, Trash2, Check, X, Moon, Sun } from "lucide-react"
import { useState, useEffect } from "react"

interface CourseSidebarProps {
  semesters: Semester[]
  activeSemesterId: string | null
  onSemesterClick: (semesterId: string) => void
  onCourseClick: (courseId: string) => void
  onAddSemester: () => void
  onDeleteSemester: (semesterId: string) => void
  onEditSemester: (semesterId: string, newName: string) => void
  onDeleteCourse: (courseId: string) => void
  onEditCourse: (courseId: string, newName: string) => void
  theme: "light" | "dark"
  onToggleTheme: () => void
}

export function CourseSidebar({
  semesters,
  activeSemesterId,
  onSemesterClick,
  onCourseClick,
  onAddSemester,
  onDeleteSemester,
  onEditSemester,
  onDeleteCourse,
  onEditCourse,
  theme,
  onToggleTheme,
}: CourseSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [editingSemesterId, setEditingSemesterId] = useState<string | null>(null)
  const [editingSemesterName, setEditingSemesterName] = useState("")
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null)
  const [editingCourseName, setEditingCourseName] = useState("")
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    itemId: string
    itemName: string
    itemType: "course" | "semester"
  }>({
    open: false,
    itemId: "",
    itemName: "",
    itemType: "course",
  })

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed")
    if (saved) {
      setIsCollapsed(JSON.parse(saved))
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", JSON.stringify(isCollapsed))
  }, [isCollapsed])

  const startEditingSemester = (semesterId: string, currentName: string) => {
    setEditingSemesterId(semesterId)
    setEditingSemesterName(currentName)
  }

  const saveEditingSemester = () => {
    if (editingSemesterId && editingSemesterName.trim()) {
      onEditSemester(editingSemesterId, editingSemesterName.trim())
    }
    setEditingSemesterId(null)
    setEditingSemesterName("")
  }

  const cancelEditingSemester = () => {
    setEditingSemesterId(null)
    setEditingSemesterName("")
  }

  const startEditingCourse = (courseId: string, currentName: string) => {
    setEditingCourseId(courseId)
    setEditingCourseName(currentName)
  }

  const saveEditingCourse = () => {
    if (editingCourseId && editingCourseName.trim()) {
      onEditCourse(editingCourseId, editingCourseName.trim())
    }
    setEditingCourseId(null)
    setEditingCourseName("")
  }

  const cancelEditingCourse = () => {
    setEditingCourseId(null)
    setEditingCourseName("")
  }

  const openDeleteDialog = (itemId: string, itemName: string, itemType: "course" | "semester") => {
    setDeleteDialog({ open: true, itemId, itemName, itemType })
  }

  const handleDeleteConfirm = () => {
    if (deleteDialog.itemType === "semester") {
      onDeleteSemester(deleteDialog.itemId)
    } else {
      onDeleteCourse(deleteDialog.itemId)
    }
  }

  if (semesters.length === 0) return null

  const activeSemester = semesters.find((s) => s.id === activeSemesterId)
  const courses = activeSemester?.courses || []

  return (
    <>
      <div
        className={`fixed left-0 top-0 h-screen border-r-2 border-primary/20 bg-card overflow-y-auto transition-all duration-300 flex flex-col ${
          isCollapsed ? "w-20" : "w-64"
        }`}
      >
        <div className="flex items-center justify-between border-b-2 border-primary/20 p-3">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <h2 className="font-sans text-base font-semibold text-primary">Manager</h2>
            </div>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsCollapsed(!isCollapsed)}>
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className={`${isCollapsed ? "p-1" : "p-3"} space-y-1 border-b-2 border-primary/20`}>
            {semesters.map((semester, index) => {
              const isActive = semester.id === activeSemesterId

              return (
                <div key={semester.id} className="group">
                  {editingSemesterId === semester.id && !isCollapsed ? (
                    <div className="flex items-center gap-1 p-1">
                      <Input
                        value={editingSemesterName}
                        onChange={(e) => setEditingSemesterName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEditingSemester()
                          if (e.key === "Escape") cancelEditingSemester()
                        }}
                        className="h-8 text-sm"
                        autoFocus
                        onFocus={(e) => e.target.select()}
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={saveEditingSemester}>
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={cancelEditingSemester}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Button
                        variant={isActive ? "default" : "ghost"}
                        className={`flex-1 justify-start text-left p-5.5 ${isActive ? "" : "hover:bg-primary/10"}`}
                        onClick={() => onSemesterClick(semester.id)}
                        title={isCollapsed ? semester.name : undefined}
                      >
                        {isCollapsed ? (
                          <div className="flex flex-col items-center w-full text-xs">
                            <span className="font-bold">S{index + 1}</span>
                          </div>
                        ) : (
                          <div className="w-full overflow-hidden">
                            <div className="truncate text-sm font-semibold">{semester.name}</div>
                            <div className="text-xs text-muted-foreground">{semester.courses.length} courses</div>
                          </div>
                        )}
                      </Button>
                      {!isCollapsed && (
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            onClick={() => startEditingSemester(semester.id, semester.name)}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                            onClick={() => openDeleteDialog(semester.id, semester.name, "semester")}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            {!isCollapsed && (
              <Button
                onClick={onAddSemester}
                variant="outline"
                size="sm"
                className="w-full mt-2 h-8 text-xs bg-transparent"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Semester
              </Button>
            )}
          </div>

          {/* Courses in active semester */}
          {courses.length > 0 && (
            <div className={`${isCollapsed ? "p-1" : "p-3"} space-y-1`}>
              {!isCollapsed && (
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Courses</h3>
              )}
              {courses.map((course, index) => {
                const numericGrade = calculateCourseGrade(course.criteria)
                const letterGrade = getLetterGrade(numericGrade, course.gradeScale)
                const gradeColor = getLetterGradeColor(letterGrade)

                return (
                  <div key={course.id} className="group">
                    {editingCourseId === course.id && !isCollapsed ? (
                      <div className="flex items-center gap-1 p-1">
                        <Input
                          value={editingCourseName}
                          onChange={(e) => setEditingCourseName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEditingCourse()
                            if (e.key === "Escape") cancelEditingCourse()
                          }}
                          className="h-8 text-sm"
                          autoFocus
                          onFocus={(e) => e.target.select()}
                        />
                        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={saveEditingCourse}>
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={cancelEditingCourse}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          className="flex-1 justify-start text-left hover:bg-primary/10 p-2"
                          onClick={() => onCourseClick(course.id)}
                          title={isCollapsed ? `${course.name} - ${letterGrade}` : undefined}
                        >
                          {isCollapsed ? (
                            <div className="flex flex-col items-center w-full text-xs">
                              <span className="font-bold text-foreground ">{course.name}</span>
                              <span className="font-semibold" style={{ color: gradeColor }}>
                                {letterGrade}
                              </span>
                            </div>
                          ) : (
                            <div className="w-full overflow-hidden">
                              <div className="truncate text-sm font-medium text-foreground">{course.name}</div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <span>{course.credits}cr</span>
                                <span>•</span>
                                <span className="font-semibold" style={{ color: gradeColor }}>
                                  {letterGrade}
                                </span>
                              </div>
                            </div>
                          )}
                        </Button>
                        {!isCollapsed && (
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 shrink-0"
                              onClick={() => startEditingCourse(course.id, course.name)}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                              onClick={() => openDeleteDialog(course.id, course.name, "course")}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="border-t-2 border-primary/20 p-3">
          <Button
            variant="ghost"
            size={isCollapsed ? "icon" : "default"}
            onClick={onToggleTheme}
            className={`${isCollapsed ? "h-10 w-10 w-full" : "w-full justify-start"}`}
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            {!isCollapsed && <span className="ml-2">{theme === "light" ? "Dark Mode" : "Light Mode"}</span>}
          </Button>
        </div>
      </div>

      <DeleteConfirmationDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}
        itemName={deleteDialog.itemName}
        itemType={deleteDialog.itemType}
        onConfirm={handleDeleteConfirm}
      />
    </>
  )
}
