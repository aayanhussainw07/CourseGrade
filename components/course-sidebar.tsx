"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { AdSenseUnit } from "@/components/adsense-unit";
import {
  calculateCourseGrade,
  getLetterGrade,
  getLetterGradeColor,
  isCourseDefault,
} from "@/lib/grade-utils";
import type { Semester } from "@/lib/types";
import {
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Download,
  Upload,
  TrendingUp,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const SIDEBAR_AD_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SIDEBAR_SLOT;

interface CourseSidebarProps {
  semesters: Semester[];
  activeSemesterId: string | null;
  onSemesterClick: (semesterId: string) => void;
  onCourseClick: (courseId: string) => void;
  onAddSemester: () => void;
  onDeleteSemester: (semesterId: string) => void;
  onEditSemester: (semesterId: string, newName: string) => void;
  onDeleteCourse: (courseId: string) => void;
  onEditCourse: (courseId: string, newName: string) => void;
  onExportSemester?: (semesterId: string) => void;
  onImportSemester?: (file: File) => void;
  onExportCourse?: (courseId: string) => void;
  onImportCourse?: (file: File, semesterId: string | null) => void;
  onExportDashboard?: () => void;
  onImportDashboard?: (file: File) => void;
  onReorderSemesters?: (orderedSemesterIds: string[]) => void;
  onReorderCourses?: (semesterId: string, orderedCourseIds: string[]) => void;
  dashboardSummary?: {
    overallGpa: number;
    totalCredits: number;
    totalSemesters: number;
  };
  onDashboardClick?: () => void;
  isDashboardActive?: boolean;
  variant?: "desktop" | "overlay";
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
  onExportSemester,
  onImportSemester,
  onExportCourse,
  onImportCourse,
  onExportDashboard,
  onImportDashboard,
  onReorderSemesters,
  onReorderCourses,
  dashboardSummary,
  onDashboardClick,
  isDashboardActive,
  variant = "desktop",
}: CourseSidebarProps) {
  const [editingSemesterId, setEditingSemesterId] = useState<string | null>(
    null
  );
  const [editingSemesterName, setEditingSemesterName] = useState("");
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editingCourseName, setEditingCourseName] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    itemId: string;
    itemName: string;
    itemType: "course" | "semester";
  }>({
    open: false,
    itemId: "",
    itemName: "",
    itemType: "course",
  });
  const [draggingSemesterId, setDraggingSemesterId] = useState<string | null>(
    null
  );
  const [draggingCourseId, setDraggingCourseId] = useState<string | null>(null);
  const semesterFileInputRef = useRef<HTMLInputElement | null>(null);
  const courseFileInputRef = useRef<HTMLInputElement | null>(null);
  const dashboardFileInputRef = useRef<HTMLInputElement | null>(null);
  const activeSemester = useMemo(
    () => semesters.find((s) => s.id === activeSemesterId),
    [semesters, activeSemesterId]
  );
  const courses = activeSemester?.courses || [];
  const scrollbarClasses =
    "pr-1 space-y-1 overflow-y-scroll scrollbar-thin scrollbar-thumb-neutral-500/70 scrollbar-track-transparent [scrollbar-color:rgba(115,115,115,0.8)_transparent] [scrollbar-width:thin] [scrollbar-gutter:stable_both-edges] [direction:rtl] [&>*]:[direction:ltr] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-neutral-600 [&::-webkit-scrollbar-thumb]:rounded-full";
  const semesterDragEnabled = Boolean(onReorderSemesters);
  const courseDragEnabled = Boolean(activeSemesterId && onReorderCourses);

  const handleSemesterDrop = (targetSemesterId: string) => {
    if (
      !semesterDragEnabled ||
      !draggingSemesterId ||
      draggingSemesterId === targetSemesterId
    )
      return;
    const semesterIds = semesters.map((semester) => semester.id);
    const fromIndex = semesterIds.indexOf(draggingSemesterId);
    const toIndex = semesterIds.indexOf(targetSemesterId);
    if (fromIndex === -1 || toIndex === -1) return;
    const updatedOrder = [...semesterIds];
    const [moved] = updatedOrder.splice(fromIndex, 1);
    updatedOrder.splice(toIndex, 0, moved);
    onReorderSemesters?.(updatedOrder);
  };

  const handleCourseDrop = (targetCourseId: string) => {
    if (
      !courseDragEnabled ||
      !draggingCourseId ||
      draggingCourseId === targetCourseId
    )
      return;
    const courseIds = courses.map((course) => course.id);
    const fromIndex = courseIds.indexOf(draggingCourseId);
    const toIndex = courseIds.indexOf(targetCourseId);
    if (fromIndex === -1 || toIndex === -1) return;
    const updatedOrder = [...courseIds];
    const [moved] = updatedOrder.splice(fromIndex, 1);
    updatedOrder.splice(toIndex, 0, moved);
    if (activeSemesterId) {
      onReorderCourses?.(activeSemesterId, updatedOrder);
    }
  };

  const startEditingSemester = (semesterId: string, currentName: string) => {
    setEditingSemesterId(semesterId);
    setEditingSemesterName(currentName);
  };

  const saveEditingSemester = () => {
    if (editingSemesterId && editingSemesterName.trim()) {
      onEditSemester(editingSemesterId, editingSemesterName.trim());
    }
    setEditingSemesterId(null);
    setEditingSemesterName("");
  };

  const cancelEditingSemester = () => {
    setEditingSemesterId(null);
    setEditingSemesterName("");
  };

  const startEditingCourse = (courseId: string, currentName: string) => {
    setEditingCourseId(courseId);
    setEditingCourseName(currentName);
  };

  const saveEditingCourse = () => {
    if (editingCourseId && editingCourseName.trim()) {
      onEditCourse(editingCourseId, editingCourseName.trim());
    }
    setEditingCourseId(null);
    setEditingCourseName("");
  };

  const cancelEditingCourse = () => {
    setEditingCourseId(null);
    setEditingCourseName("");
  };

  const openDeleteDialog = (
    itemId: string,
    itemName: string,
    itemType: "course" | "semester"
  ) => {
    if (itemType === "semester") {
      const semester = semesters.find((s) => s.id === itemId);
      if (!semester || semester.courses.length === 0) {
        onDeleteSemester(itemId);
        return;
      }
    }
    if (itemType === "course") {
      const course = activeSemester?.courses.find((c) => c.id === itemId);
      if (course && isCourseDefault(course)) {
        onDeleteCourse(itemId);
        return;
      }
    }
    setDeleteDialog({ open: true, itemId, itemName, itemType });
  };

  const handleDeleteConfirm = () => {
    if (deleteDialog.itemType === "semester") {
      onDeleteSemester(deleteDialog.itemId);
    } else {
      onDeleteCourse(deleteDialog.itemId);
    }
  };

  const containerClass = cn(
    "overflow-hidden border-r border-primary/20 bg-card/95 backdrop-blur flex flex-col shadow-lg",
    variant === "desktop"
      ? "fixed left-0 top-0 hidden h-screen w-64 lg:flex"
      : "h-full w-full rounded-none border-0 shadow-none"
  );

  return (
    <>
      <div className={containerClass}>
        <div className="flex items-center justify-between border-b-2 border-primary/20 p-2">
          <div className="flex mx-auto mt-1 items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              Overview
            </span>
          </div>
          <input
            ref={semesterFileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file && onImportSemester) {
                onImportSemester(file);
              }
              event.target.value = "";
            }}
          />
          <div className="flex items-center gap-1">
            <input
              ref={dashboardFileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file && onImportDashboard) {
                  onImportDashboard(file);
                }
                event.target.value = "";
              }}
            />
            {onImportDashboard && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => dashboardFileInputRef.current?.click()}
                title="Import dashboard backup"
              >
                <Upload className="h-3.5 w-3.5" />
              </Button>
            )}
            {onExportDashboard && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={onExportDashboard}
                title="Export dashboard backup"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-2 p-2 border-primary/20">
            {dashboardSummary &&
              Number.isFinite(dashboardSummary.overallGpa) && (
                <div className="text-xs text-muted-foreground">
                  {onDashboardClick ? (
                    <button
                      type="button"
                      onClick={onDashboardClick}
                      className={cn(
                        "w-full rounded-lg border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                        isDashboardActive &&
                          "border-primary/50 bg-primary/20 text-foreground shadow-md"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">
                          Dashboard
                        </span>
                        <TrendingUp className="h-4 w-4 text-primary" />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-sm font-semibold text-foreground">
                        <span>
                          {dashboardSummary.overallGpa.toFixed(2)} GPA
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">
                          View
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span>Total Credits</span>
                        <span className="font-semibold text-foreground">
                          {Number.isFinite(dashboardSummary.totalCredits)
                            ? dashboardSummary.totalCredits
                            : "-"}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span>Semesters</span>
                        <span className="font-semibold text-foreground">
                          {Number.isFinite(dashboardSummary.totalSemesters)
                            ? dashboardSummary.totalSemesters
                            : "-"}
                        </span>
                      </div>
                    </button>
                  ) : (
                    <div className="rounded-lg border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-foreground">
                          {dashboardSummary.overallGpa.toFixed(2)} GPA
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span>Total Credits</span>
                        <span className="font-semibold text-foreground">
                          {Number.isFinite(dashboardSummary.totalCredits)
                            ? dashboardSummary.totalCredits
                            : "-"}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span>Semesters</span>
                        <span className="font-semibold text-foreground">
                          {Number.isFinite(dashboardSummary.totalSemesters)
                            ? dashboardSummary.totalSemesters
                            : "-"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Semesters
            </h3>
            <div className="flex items-center gap-1">
              <input
                ref={courseFileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file && onImportCourse) {
                    onImportCourse(file, activeSemesterId);
                  }
                  event.target.value = "";
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => courseFileInputRef.current?.click()}
                title="Import course JSON"
              >
                <Upload className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="mt-4 mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Semesters
              </h3>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => semesterFileInputRef.current?.click()}
                  title="Import semester JSON"
                >
                  <Upload className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className={cn("max-h-[150px]", scrollbarClasses)}>
              {semesters.map((semester) => {
                const isActive = semester.id === activeSemesterId;

                return (
                  <div
                    key={semester.id}
                    className={cn(
                      "group space-y-1",
                      draggingSemesterId === semester.id && "opacity-60"
                    )}
                    draggable={
                      semesterDragEnabled && editingSemesterId !== semester.id
                    }
                    onDragStart={(event) => {
                      if (
                        !semesterDragEnabled ||
                        editingSemesterId === semester.id
                      )
                        return;
                      setDraggingSemesterId(semester.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(event) => {
                      if (
                        !semesterDragEnabled ||
                        !draggingSemesterId ||
                        draggingSemesterId === semester.id
                      )
                        return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(event) => {
                      if (!semesterDragEnabled) return;
                      event.preventDefault();
                      handleSemesterDrop(semester.id);
                      setDraggingSemesterId(null);
                    }}
                    onDragEnd={() => setDraggingSemesterId(null)}
                  >
                    {editingSemesterId === semester.id ? (
                      <div className="flex items-center gap-1 p-1">
                        <Input
                          value={editingSemesterName}
                          onChange={(e) =>
                            setEditingSemesterName(e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEditingSemester();
                            if (e.key === "Escape") cancelEditingSemester();
                          }}
                          className="h-8 text-sm"
                          autoFocus
                          onFocus={(e) => e.target.select()}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          onClick={saveEditingSemester}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          onClick={cancelEditingSemester}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 p-1">
                        <Button
                          variant="ghost"
                          className={cn(
                            "flex-1 min-w-0 overflow-hidden p-4 text-left justify-start",
                            semesterDragEnabled &&
                              "cursor-grab active:cursor-grabbing",
                            isActive
                              ? "bg-primary/8 hover:bg-primary/20"
                              : "hover:bg-primary/10"
                          )}
                          onClick={() => onSemesterClick(semester.id)}
                          onDoubleClick={() => {
                            startEditingSemester(semester.id, semester.name);
                          }}
                        >
                          <div className="w-full min-w-0 overflow-hidden">
                            <div className="truncate text-sm font-semibold">
                              {semester.name}
                            </div>
                          </div>
                        </Button>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            onClick={() =>
                              startEditingSemester(semester.id, semester.name)
                            }
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            onClick={() => onExportSemester?.(semester.id)}
                            title="Export semester JSON"
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                            onClick={() =>
                              openDeleteDialog(
                                semester.id,
                                semester.name,
                                "semester"
                              )
                            }
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {semesters.length === 0 && (
              <div className="rounded border border-dashed border-primary/20 p-4 text-center text-xs text-muted-foreground">
                No semesters yet. Use the button below to create your first
                semester.
              </div>
            )}
            <div className="mt-1 flex items-center gap-2">
              <Button
                type="button"
                onClick={onAddSemester}
                variant="outline"
                size="sm"
                className="flex-1 h-8 gap-1 text-[11px] bg-card"
              >
                <Plus className="h-3 w-3" />
                Add Semester
              </Button>
            </div>
          </div>

          {/* Courses in active semester */}
          {activeSemesterId && (
            <div className="p-3 space-y-1">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Courses
                </h3>
                <div className="flex items-center gap-1">
                  <input
                    ref={courseFileInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file && onImportCourse) {
                        onImportCourse(file, activeSemesterId);
                      }
                      event.target.value = "";
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => courseFileInputRef.current?.click()}
                    title="Import course JSON"
                  >
                    <Upload className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {courses.length === 0 && (
                <div className="rounded border border-dashed border-primary/20 p-3 text-center text-[11px] text-muted-foreground">
                  No courses yet. Import a course or add one from the main view.
                </div>
              )}
              <div className={cn("max-h-[315px]", scrollbarClasses)}>
                {courses.map((course, index) => {
                  const numericGrade = calculateCourseGrade(course.criteria);
                  const letterGrade = getLetterGrade(
                    numericGrade,
                    course.gradeScale
                  );
                  const gradeColor = getLetterGradeColor(letterGrade);
                  const displayGrade = course.isPassFail
                    ? numericGrade >= 60
                      ? "P"
                      : "F"
                    : letterGrade;
                  const displayColor = course.isPassFail
                    ? "#6b7280"
                    : gradeColor;

                  return (
                    <div
                      key={`${course.id}-${index}`}
                      className={cn(
                        "group",
                        draggingCourseId === course.id && "opacity-60"
                      )}
                      draggable={
                        courseDragEnabled && editingCourseId !== course.id
                      }
                      onDragStart={(event) => {
                        if (!courseDragEnabled || editingCourseId === course.id)
                          return;
                        setDraggingCourseId(course.id);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(event) => {
                        if (
                          !courseDragEnabled ||
                          !draggingCourseId ||
                          draggingCourseId === course.id
                        )
                          return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(event) => {
                        if (!courseDragEnabled) return;
                        event.preventDefault();
                        handleCourseDrop(course.id);
                        setDraggingCourseId(null);
                      }}
                      onDragEnd={() => setDraggingCourseId(null)}
                    >
                      {editingCourseId === course.id ? (
                        <div className="flex items-center gap-1 p-1">
                          <Input
                            value={editingCourseName}
                            onChange={(e) =>
                              setEditingCourseName(e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEditingCourse();
                              if (e.key === "Escape") cancelEditingCourse();
                            }}
                            className="h-8 text-sm"
                            autoFocus
                            onFocus={(e) => e.target.select()}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            onClick={saveEditingCourse}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            onClick={cancelEditingCourse}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 p-1">
                          <Button
                            variant="ghost"
                            className={cn(
                              "flex-1 justify-start p-2 text-left hover:bg-primary/10",
                              courseDragEnabled &&
                                "cursor-grab active:cursor-grabbing"
                            )}
                            onClick={() => onCourseClick(course.id)}
                          >
                            <div className="w-full overflow-hidden">
                              <div className="truncate text-sm font-medium text-foreground">
                                {course.name}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <span>{course.credits}cr</span>
                                <span>•</span>
                                <span
                                  className="font-semibold"
                                  style={{ color: displayColor }}
                                >
                                  {displayGrade}
                                </span>
                              </div>
                            </div>
                          </Button>
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 shrink-0"
                              onClick={() => onExportCourse?.(course.id)}
                              title="Export course"
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 shrink-0"
                              onClick={() =>
                                startEditingCourse(course.id, course.name)
                              }
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                              onClick={() =>
                                openDeleteDialog(
                                  course.id,
                                  course.name,
                                  "course"
                                )
                              }
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {SIDEBAR_AD_SLOT ? (
                <div className="mt-4">
                  <AdSenseUnit
                    slot={SIDEBAR_AD_SLOT}
                    className="w-full rounded-lg border border-dashed border-primary/20"
                    style={{ minHeight: 120 }}
                  />
                </div>
              ) : null}
            </div>
          )}
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
  );
}
