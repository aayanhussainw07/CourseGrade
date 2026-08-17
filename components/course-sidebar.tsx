"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import {
  calculateCourseGrade,
  calculateGPA,
  getLetterGrade,
  getLetterGradeColor,
  isCourseDefault,
} from "@/lib/grade-utils";
import type { Semester } from "@/lib/types";
import {
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

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
  onReorderSemesters?: (orderedSemesterIds: string[]) => void;
  onReorderCourses?: (semesterId: string, orderedCourseIds: string[]) => void;
  onToggleSemesterIgnore?: (semesterId: string) => void;
  ignoredSemesterIds?: Set<string>;
  skipSemesterDeleteConfirm?: boolean;
  skipCourseDeleteConfirm?: boolean;
  userEmail?: string;
  onSignOut?: () => void;
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
  onReorderSemesters,
  onReorderCourses,
  onToggleSemesterIgnore,
  ignoredSemesterIds,
  skipSemesterDeleteConfirm,
  skipCourseDeleteConfirm,
  userEmail,
  onSignOut,
  variant = "desktop",
}: CourseSidebarProps) {
  const [editingSemesterId, setEditingSemesterId] = useState<string | null>(
    null,
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
    null,
  );
  const [draggingCourseId, setDraggingCourseId] = useState<string | null>(null);
  const activeSemester = useMemo(
    () => semesters.find((s) => s.id === activeSemesterId),
    [semesters, activeSemesterId],
  );
  const courses = activeSemester?.courses || [];
  const scrollbarClasses =
    "pr-1 space-y-1 overflow-y-scroll [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.25)_rgba(255,255,255,0.05)] [scrollbar-gutter:stable_both-edges] [direction:rtl] [&>*]:[direction:ltr] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:block [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-white/5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/25";
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
    itemType: "course" | "semester",
  ) => {
    if (itemType === "semester") {
      const semester = semesters.find((s) => s.id === itemId);
      if (
        !semester ||
        semester.courses.length === 0 ||
        skipSemesterDeleteConfirm
      ) {
        onDeleteSemester(itemId);
        return;
      }
    }
    if (itemType === "course") {
      const course = activeSemester?.courses.find((c) => c.id === itemId);
      if ((course && isCourseDefault(course)) || skipCourseDeleteConfirm) {
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
    "overflow-hidden bg-foreground text-white flex flex-col",
    variant === "desktop"
      ? "fixed inset-y-0 left-0 hidden w-52 md:flex lg:w-64"
      : "h-full w-full rounded-none border-0",
  );

  return (
    <>
      <div
        data-onboarding-target={`sidebar-${variant === "desktop" ? "desktop" : "overlay"}`}
        className={containerClass}
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 40px)",
        }}
      >
        <div>
          <div className="flex mx-auto mt-1 items-center justify-center gap-2 px-2 pt-2 pb-1">
            <Image
              src="/coursegrade.png"
              alt="CourseGrade"
              width={20}
              height={20}
              className="h-5 w-5"
            />
            <span className="text-sm font-semibold text-white">
              coursegrade.
            </span>
          </div>
          <div className="flex flex-col items-center pb-2 gap-0.5">
            {userEmail && (
              <span className="text-[10px] text-white/60 truncate max-w-[90%]">
                {userEmail}
              </span>
            )}
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="text-[10px] text-white/45 hover:text-white/80 transition-colors"
              >
                Sign out
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-2 p-2 border-primary/20">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">
                Semesters
              </h3>
            </div>
            <div className={cn("max-h-[150px]", scrollbarClasses)}>
              {semesters.map((semester) => {
                const isActive = semester.id === activeSemesterId;

                return (
                  <div
                    key={semester.id}
                    className={cn(
                      "group space-y-1",
                      draggingSemesterId === semester.id && "opacity-60",
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
                      <div className="flex items-center gap-2 p-1">
                        <Input
                          value={editingSemesterName}
                          onChange={(e) =>
                            setEditingSemesterName(e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEditingSemester();
                            if (e.key === "Escape") cancelEditingSemester();
                          }}
                          className="h-8 text-sm bg-white/10 text-white border-white/25 placeholder:text-white/30"
                          autoFocus
                          onFocus={(e) => e.target.select()}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0 text-white/60 hover:text-white hover:bg-white/10"
                          onClick={saveEditingSemester}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0 text-white/60 hover:text-white hover:bg-white/10"
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
                            "flex-1 min-w-0 overflow-hidden px-2 py-6 text-left justify-start hover:text-white",
                            semesterDragEnabled &&
                              "cursor-grab active:cursor-grabbing",
                            isActive
                              ? "bg-white/15 hover:bg-white/20"
                              : "hover:bg-white/10",
                            ignoredSemesterIds?.has(semester.id)
                              ? "text-white/35"
                              : "text-white",
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
                            {semester.courses.length > 0 && (
                              <div className={cn("text-[10px] mt-0.5", ignoredSemesterIds?.has(semester.id) ? "text-white/25 line-through" : "text-white/45")}>
                                {calculateGPA(semester.courses).toFixed(2)}
                              </div>
                            )}
                          </div>
                        </Button>
                        <div className={cn("flex gap-0.5 transition-opacity", ignoredSemesterIds?.has(semester.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100")}>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0 text-white/50 hover:text-white hover:bg-white/10"
                            onClick={() =>
                              startEditingSemester(semester.id, semester.name)
                            }
                            title="Rename"
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          {onToggleSemesterIgnore && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className={cn(
                                "h-8 w-8 shrink-0 hover:bg-white/10",
                                ignoredSemesterIds?.has(semester.id)
                                  ? "text-white/60 hover:text-white"
                                  : "text-white/50 hover:text-white",
                              )}
                              onClick={() => onToggleSemesterIgnore(semester.id)}
                              title={ignoredSemesterIds?.has(semester.id) ? "Include in GPA" : "Exclude from GPA"}
                            >
                              {ignoredSemesterIds?.has(semester.id)
                                ? <EyeOff className="h-3 w-3" />
                                : <Eye className="h-3 w-3" />
                              }
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0 text-red-400 hover:text-red-300 hover:bg-red-400/10"
                            onClick={() =>
                              openDeleteDialog(
                                semester.id,
                                semester.name,
                                "semester",
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
              <div className="rounded border border-dashed border-white/15 p-4 text-center text-xs text-white/40">
                No semesters yet. Use the button below to create your first
                semester.
              </div>
            )}
            <div className="mt-1 flex items-center gap-2">
              <Button
                type="button"
                data-onboarding-target="add-semester"
                onClick={onAddSemester}
                variant="outline"
                size="sm"
                className="flex-1 h-8 gap-1 text-[11px] bg-white/8 text-white border-white/25 hover:bg-white/15 hover:text-white hover:border-white/40"
              >
                <Plus className="h-3 w-3" />
                Add Semester
              </Button>
            </div>
          </div>

          {/* Courses in active semester */}
          {activeSemesterId && (
            <div className="p-3 space-y-1">
              <div className="mb-2">
                <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wide">
                  Courses
                </h3>
              </div>
              {courses.length === 0 && (
                <div className="rounded border border-dashed border-white/15 p-3 text-center text-[11px] text-white/40">
                  No courses yet. Import a course or add one from the main view.
                </div>
              )}
              <div className={cn("max-h-[315px]", scrollbarClasses)}>
                {courses.map((course, index) => {
                  const numericGrade = calculateCourseGrade(
                    course.criteria,
                    course.percentBoost,
                  );
                  const letterGrade = getLetterGrade(
                    numericGrade,
                    course.gradeScale,
                  );
                  const gradeColor = getLetterGradeColor(letterGrade, course.gradeScale);
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
                        draggingCourseId === course.id && "opacity-60",
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
                            className="h-8 text-sm bg-white/10 text-white border-white/25 placeholder:text-white/30"
                            autoFocus
                            onFocus={(e) => e.target.select()}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0 text-white/60 hover:text-white hover:bg-white/10"
                            onClick={saveEditingCourse}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0 text-white/60 hover:text-white hover:bg-white/10"
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
                              "flex-1 justify-start p-2 text-left hover:bg-white/10 text-white hover:text-white",
                              courseDragEnabled &&
                                "cursor-grab active:cursor-grabbing",
                            )}
                            onClick={() => onCourseClick(course.id)}
                          >
                            <div className="w-full overflow-hidden">
                              <div className="truncate text-sm font-medium text-white">
                                {course.name}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-white/50">
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
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 shrink-0 text-white/50 hover:text-white hover:bg-white/10"
                              onClick={() =>
                                startEditingCourse(course.id, course.name)
                              }
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 shrink-0 text-red-400 hover:text-red-300 hover:bg-red-400/10"
                              onClick={() =>
                                openDeleteDialog(
                                  course.id,
                                  course.name,
                                  "course",
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
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-1.5 py-4">
          <p className="text-xs text-white/40">Made with ♥ by @aayanh7</p>
          <a
            href="https://www.buymeacoffee.com/aayanh7"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-white/35 hover:text-white/50 transition-colors animate-coffee-bounce inline-block"
          >
            ☕ buy me a coffee (if you want!)
          </a>
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
