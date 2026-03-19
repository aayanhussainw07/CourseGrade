"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Upload,
  FileText,
  X,
  Sparkles,
  AlertCircle,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { syllabusApi, type SyllabusExtracted } from "@/lib/api";
import type { CoursePortableData } from "@/lib/csv";
import { DEFAULT_GRADE_SCALE } from "@/lib/types";

interface SyllabusImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  semesterId: string;
  semesterName: string;
  onImport: (data: CoursePortableData, semesterId: string) => Promise<unknown>;
}

type Phase = "idle" | "loading" | "preview" | "error";

const ALLOWED_EXTENSIONS = ".pdf,.png,.jpg,.jpeg,.webp";
const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];

export function SyllabusImportDialog({
  open,
  onOpenChange,
  semesterId,
  semesterName,
  onImport,
}: SyllabusImportDialogProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [importsRemaining, setImportsRemaining] = useState<number | null>(null);
  const [extracted, setExtracted] = useState<SyllabusExtracted | null>(null);
  const [editedName, setEditedName] = useState("");
  const [editedCredits, setEditedCredits] = useState(3);
  const [editedAssignments, setEditedAssignments] = useState<
    Array<{ name: string; weight: number; drop_lowest: number }>
  >([]);
  const [isCreating, setIsCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setPhase("idle");
    setFile(null);
    setText("");
    setIsDragging(false);
    setErrorMsg("");
    setExtracted(null);
    setEditedName("");
    setEditedCredits(3);
    setEditedAssignments([]);
    setIsCreating(false);
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (phase === "loading") return; // non-dismissable while loading
    if (!next) reset();
    onOpenChange(next);
  };

  const selectFile = (f: File) => {
    if (!ALLOWED_TYPES.includes(f.type)) {
      setErrorMsg("Only PDF, PNG, JPG, or WEBP files are supported.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setErrorMsg("File must be under 10 MB.");
      return;
    }
    setErrorMsg("");
    setFile(f);
    setText(""); // clear text when file is chosen
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) selectFile(f);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) selectFile(f);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (e.target.value) setFile(null); // clear file when typing
    setErrorMsg("");
  };

  const canAnalyze = (!!file || text.trim().length > 0) && phase === "idle";

  const analyze = async () => {
    if (!canAnalyze) return;
    setPhase("loading");

    const formData = new FormData();
    if (file) {
      formData.append("file", file);
    } else {
      formData.append("text", text.trim());
    }
    formData.append("semesterId", semesterId);

    try {
      const result = await syllabusApi.analyze(formData);
      setExtracted(result.extracted);
      setEditedName(result.extracted.courseName);
      setEditedCredits(result.extracted.credits);
      setEditedAssignments(result.extracted.assignments.map((a) => ({ ...a })));
      setImportsRemaining(result.importsRemaining);
      setPhase("preview");
    } catch (err: unknown) {
      const e = err as {
        message?: string;
        code?: string;
        retryAfterSeconds?: number;
      };
      if (e.code === "RATE_LIMITED") {
        const secs = e.retryAfterSeconds ?? 300;
        const mins = Math.ceil(secs / 60);
        setErrorMsg(
          `Import limit reached. Try again in ${mins > 1 ? `${mins} minutes` : `${secs} seconds`}.`,
        );
      } else {
        setErrorMsg(e.message || "Something went wrong. Please try again.");
      }
      setPhase("error");
    }
  };

  const createCourse = async () => {
    if (!extracted || isCreating) return;
    setIsCreating(true);

    const courseData: CoursePortableData = {
      name: editedName.trim() || extracted.courseName,
      credits: editedCredits,
      isPassFail: extracted.isPassFail,
      passLabel: "P",
      failLabel: "F",
      passThreshold: 60,
      cardColor: null,
      percentBoost: 0,
      gradeScale: DEFAULT_GRADE_SCALE.map((g) => ({ ...g })),
      criteria: editedAssignments.map((a) => ({
        name: a.name,
        weight: a.weight,
        score: 0,
        extraCredit: 0,
        dropLowest: a.drop_lowest,
        subItems: [],
      })),
    };

    try {
      await onImport(courseData, semesterId);
      reset();
      onOpenChange(false);
    } catch {
      setErrorMsg("Failed to create course. Please try again.");
      setPhase("error");
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold uppercase tracking-wide text-primary">
            <Sparkles className="h-4 w-4" />
            Import Syllabus
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {/* PHASE: idle — upload or paste */}
          {phase === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <p className="text-xs text-muted-foreground">
                Adding to:{" "}
                <span className="font-semibold text-foreground">
                  {semesterName}
                </span>
              </p>

              {/* Drop zone */}
              <div
                className={`relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
                  isDragging
                    ? "border-primary bg-primary/8"
                    : "border-border/60 hover:border-primary/50 hover:bg-muted/40"
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_EXTENSIONS}
                  className="hidden"
                  onChange={handleFileInput}
                />
                {file ? (
                  <>
                    <FileText className="h-7 w-7 text-primary" />
                    <p className="text-sm font-medium text-foreground">
                      {file.name}
                    </p>
                    <button
                      className="absolute right-2 top-2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <Upload className="h-7 w-7 text-muted-foreground/60" />
                    <p className="text-sm text-muted-foreground">
                      Drop a PDF or image here, or{" "}
                      <span className="font-medium text-primary">
                        click to browse
                      </span>
                    </p>
                    <p className="text-[11px] text-muted-foreground/60">
                      PDF, PNG, JPG, WEBP — max 10 MB
                    </p>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border/50" />
                <span className="text-xs text-muted-foreground">
                  or paste text
                </span>
                <div className="h-px flex-1 bg-border/50" />
              </div>

              <textarea
                value={text}
                onChange={handleTextChange}
                placeholder="Paste your syllabus text or image here..."
                rows={4}
                className="w-full resize-y rounded-md border border-input bg-background/80 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                onPaste={(e) => {
                  const imageItem = Array.from(e.clipboardData.items).find(
                    (item) =>
                      item.kind === "file" && item.type.startsWith("image/"),
                  );
                  if (imageItem) {
                    e.preventDefault();
                    const f = imageItem.getAsFile();
                    if (f) selectFile(f);
                  }
                }}
              />

              {errorMsg && (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {errorMsg}
                </p>
              )}

              {importsRemaining !== null && (
                <p className="text-xs text-muted-foreground">
                  {importsRemaining} import{importsRemaining !== 1 ? "s" : ""}{" "}
                  remaining this window
                </p>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!canAnalyze}
                  onClick={analyze}
                  className="gap-2 bg-primary text-white hover:bg-primary/90"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Analyze
                </Button>
              </div>
            </motion.div>
          )}

          {/* PHASE: loading */}
          {phase === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center gap-4 py-10"
            >
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Analyzing your syllabus…
              </p>
            </motion.div>
          )}

          {/* PHASE: preview */}
          {phase === "preview" && extracted && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <p className="text-xs text-muted-foreground">
                Review the extracted details before creating the course.
              </p>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Course Name
                  </label>
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="w-full rounded-md border border-input bg-background/80 px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Credits
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={editedCredits}
                    onChange={(e) =>
                      setEditedCredits(
                        Math.max(1, Math.min(6, parseInt(e.target.value) || 3)),
                      )
                    }
                    className="w-20 rounded-md border border-input bg-background/80 px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Grading Breakdown
                  </label>
                  <div className="space-y-1 rounded-md border border-border/50 bg-muted/20 p-2">
                    {editedAssignments.map((a, i) => (
                      <div key={i} className="group flex items-center gap-2">
                        <input
                          type="text"
                          value={a.name}
                          onChange={(e) =>
                            setEditedAssignments((prev) =>
                              prev.map((x, j) =>
                                j === i ? { ...x, name: e.target.value } : x,
                              ),
                            )
                          }
                          className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-2 py-1 text-sm text-foreground outline-none hover:border-border focus:border-primary/50 focus:bg-background/80 focus:ring-1 focus:ring-primary/30"
                        />
                        <div className="flex shrink-0 items-center gap-0.5">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={a.weight}
                            onChange={(e) =>
                              setEditedAssignments((prev) =>
                                prev.map((x, j) =>
                                  j === i
                                    ? {
                                        ...x,
                                        weight: Math.max(
                                          0,
                                          Math.min(
                                            100,
                                            parseFloat(e.target.value) || 0,
                                          ),
                                        ),
                                      }
                                    : x,
                                ),
                              )
                            }
                            className="w-14 rounded border border-transparent bg-transparent px-2 py-1 text-right text-sm font-semibold text-primary outline-none hover:border-border focus:border-primary/50 focus:bg-background/80 focus:ring-1 focus:ring-primary/30"
                          />
                          <span className="text-sm font-semibold text-primary">
                            %
                          </span>
                        </div>
                        <button
                          onClick={() =>
                            setEditedAssignments((prev) =>
                              prev.filter((_, j) => j !== i),
                            )
                          }
                          className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {errorMsg && (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {errorMsg}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reset}
                  disabled={isCreating}
                >
                  Back
                </Button>
                <Button
                  size="sm"
                  onClick={createCourse}
                  disabled={isCreating || !editedName.trim()}
                  className="gap-2 bg-primary text-white hover:bg-primary/90"
                >
                  {isCreating && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  Create Course
                </Button>
              </div>
            </motion.div>
          )}

          {/* PHASE: error */}
          {phase === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center gap-4 py-8 text-center"
            >
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-foreground">{errorMsg}</p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={reset}
                  className="bg-primary text-white hover:bg-primary/90"
                >
                  Try Again
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
