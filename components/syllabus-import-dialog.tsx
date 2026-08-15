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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { syllabusApi, type SyllabusExtracted } from "@/lib/api";
import type { CoursePortableData } from "@/lib/csv";
import { DEFAULT_GRADE_SCALE } from "@/lib/types";
import { getRandomHeaderColor } from "@/lib/header-colors";

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
const paperPanelClass =
  "relative overflow-hidden rounded-lg border border-primary/25 bg-white/50 p-4 text-foreground";
const paperTapeClass =
  "pointer-events-none absolute -top-2 h-5 w-16 bg-primary/12";

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
  const [editedCreditsDraft, setEditedCreditsDraft] = useState("3");
  const [editedAssignments, setEditedAssignments] = useState<
    Array<{
      clientId: string;
      name: string;
      weight: number;
      drop_lowest: number;
    }>
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
    setEditedCreditsDraft("3");
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

  const hasAnalyzeInput = !!file || text.trim().length > 0;
  const canAnalyze = hasAnalyzeInput && phase === "idle";

  const analyze = async () => {
    if (!hasAnalyzeInput || phase === "loading") return;
    setErrorMsg("");
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
      setEditedCreditsDraft(String(result.extracted.credits));
      setEditedAssignments(
        result.extracted.assignments.map((a) => ({
          ...a,
          clientId: crypto.randomUUID(),
        })),
      );
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

    const parsedCredits = Number.parseFloat(editedCreditsDraft.trim());
    const normalizedCredits = Number.isFinite(parsedCredits)
      ? Math.max(0, Number.parseFloat(parsedCredits.toFixed(2)))
      : 3;

    const courseData: CoursePortableData = {
      name: editedName.trim() || extracted.courseName,
      credits: normalizedCredits,
      isPassFail: extracted.isPassFail,
      passLabel: "P",
      failLabel: "F",
      passThreshold: 60,
      headerColor: getRandomHeaderColor(),
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
      <DialogContent
        className="max-h-[88vh] w-[min(92vw,860px)] max-w-none gap-0 overflow-hidden border-2 border-primary/25 bg-[#fff8f1] p-0 text-foreground sm:rounded-xl"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="relative border-b border-primary/20 bg-[#fff3ea] px-5 pb-4 pt-5 text-left sm:px-7 sm:pt-6">
          <div className={`${paperTapeClass} left-10 rotate-[-2deg]`} />
          <DialogTitle className="flex items-center gap-2 font-heading text-lg font-bold uppercase tracking-wide text-primary">
            <Sparkles className="h-4 w-4" />
            Import Syllabus
          </DialogTitle>
          <DialogDescription className="max-w-2xl text-sm text-muted-foreground">
            Add a course to{" "}
            <span className="font-semibold text-foreground">{semesterName}</span>{" "}
            by uploading a syllabus file or pasting the text.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(88vh-92px)] overflow-y-auto">
          <AnimatePresence mode="wait">
          {/* PHASE: idle — upload or paste */}
          {phase === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="px-4 pb-4 sm:px-6 sm:pb-6"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <section className={`${paperPanelClass} flex min-h-[280px] flex-col`}>
                  <div className={`${paperTapeClass} right-10 rotate-2`} />
                  <div className="mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Upload file
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      PDFs and screenshots work best for detailed syllabi.
                    </p>
                  </div>

                  {/* Drop zone */}
                  <div
                    className={`relative flex flex-1 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
                      isDragging
                        ? "border-primary bg-primary/10"
                        : "border-primary/20 bg-[#fff8f1]/70 hover:border-primary/60 hover:bg-primary/5"
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
                        <FileText className="h-10 w-10 text-primary" />
                        <p className="max-w-full truncate text-sm font-semibold text-foreground">
                          {file.name}
                        </p>
                        <button
                          className="absolute right-3 top-3 rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-foreground"
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
                        <Upload className="h-10 w-10 text-primary/70" />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            Drop a PDF or image here
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            or{" "}
                            <span className="font-semibold text-primary">
                              click to browse
                            </span>
                          </p>
                        </div>
                        <p className="text-[11px] text-muted-foreground/70">
                          PDF, PNG, JPG, WEBP — max 10 MB
                        </p>
                      </>
                    )}
                  </div>
                </section>

                <section className={`${paperPanelClass} flex min-h-[280px] flex-col`}>
                  <div className={`${paperTapeClass} left-10 rotate-[-2deg]`} />
                  <div className="mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Paste text
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Paste syllabus text, or paste an image from your clipboard.
                    </p>
                  </div>

                  <textarea
                    value={text}
                    onChange={handleTextChange}
                    placeholder="Paste your syllabus text or image here..."
                    className="min-h-[210px] flex-1 resize-y rounded-md border-2 border-primary/20 bg-[#fff8f1] px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                    onPaste={(e) => {
                      const imageItem = Array.from(e.clipboardData.items).find(
                        (item) =>
                          item.kind === "file" &&
                          item.type.startsWith("image/"),
                      );
                      if (imageItem) {
                        e.preventDefault();
                        const f = imageItem.getAsFile();
                        if (f) selectFile(f);
                      }
                    }}
                  />
                </section>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-h-5">
                  {errorMsg && (
                    <p className="flex items-center gap-1.5 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      {errorMsg}
                    </p>
                  )}

                  {importsRemaining !== null && !errorMsg && (
                    <p className="text-xs text-muted-foreground">
                      {importsRemaining} import
                      {importsRemaining !== 1 ? "s" : ""} remaining this window
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenChange(false)}
                    className="hover:bg-primary/10"
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
              className="px-4 pb-4 sm:px-6 sm:pb-6"
            >
              <div className={`${paperPanelClass} flex min-h-[320px] flex-col items-center justify-center gap-4 p-8 text-center`}>
                <div className={`${paperTapeClass} left-1/2 -translate-x-1/2 rotate-2`} />
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <div>
                  <p className="text-base font-semibold text-foreground">
                    Analyzing your syllabus
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Extracting course details and grading breakdown…
                  </p>
                </div>
              </div>
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
              className="px-4 pb-4 sm:px-6 sm:pb-6"
            >
              <div className={`${paperPanelClass} p-4 sm:p-5`}>
                <div className={`${paperTapeClass} right-12 rotate-2`} />
                <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Review course
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Confirm the extracted details before creating the course.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_120px]">
                  <div className="space-y-1">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Course Name
                    </label>
                    <input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="w-full rounded-md border-2 border-primary/20 bg-[#fff8f1] px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Credits
                    </label>
                      <input
                        type="number"
                      min={0}
                      step={0.25}
                      value={editedCreditsDraft}
                      onChange={(e) => setEditedCreditsDraft(e.target.value)}
                      onBlur={() => {
                        const parsedCredits = Number.parseFloat(
                          editedCreditsDraft.trim(),
                        );
                        const normalizedCredits = Number.isFinite(
                          parsedCredits,
                        )
                          ? Math.max(0, Number.parseFloat(parsedCredits.toFixed(2)))
                          : 3;

                        setEditedCreditsDraft(String(normalizedCredits));
                      }}
                      className="w-full rounded-md border-2 border-primary/20 bg-[#fff8f1] px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                </div>

                <div className="mt-4 space-y-1.5">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Grading Breakdown
                  </label>
                  <div className="max-h-[34vh] space-y-2 overflow-y-auto rounded-md border border-primary/20 bg-[#fff8f1]/70 p-2">
                    {editedAssignments.map((a) => (
                      <div
                        key={a.clientId}
                        className="group relative flex items-center gap-2 overflow-hidden rounded-md border border-primary/15 bg-white/45 px-2 py-1"
                      >
                        <input
                          type="text"
                          value={a.name}
                          onChange={(e) =>
                            setEditedAssignments((prev) =>
                              prev.map((x) =>
                                x.clientId === a.clientId
                                  ? { ...x, name: e.target.value }
                                  : x,
                              ),
                            )
                          }
                          className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-2 py-1 text-sm text-foreground outline-none hover:border-primary/20 focus:border-primary/50 focus:bg-[#fff8f1] focus:ring-1 focus:ring-primary/30"
                        />
                        <div className="flex shrink-0 items-center gap-0.5">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={a.weight}
                            onChange={(e) =>
                              setEditedAssignments((prev) =>
                                prev.map((x) =>
                                  x.clientId === a.clientId
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
                            className="w-14 rounded border border-transparent bg-transparent px-2 py-1 text-right text-sm font-semibold text-primary outline-none hover:border-primary/20 focus:border-primary/50 focus:bg-[#fff8f1] focus:ring-1 focus:ring-primary/30"
                          />
                          <span className="text-sm font-semibold text-primary">
                            %
                          </span>
                        </div>
                        <button
                          onClick={() =>
                            setEditedAssignments((prev) =>
                              prev.filter((x) => x.clientId !== a.clientId),
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

                {errorMsg && (
                  <p className="mt-4 flex items-center gap-1.5 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {errorMsg}
                  </p>
                )}

                <div className="mt-5 flex justify-end gap-2">
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
              className="px-4 pb-4 sm:px-6 sm:pb-6"
            >
              <div className={`${paperPanelClass} flex min-h-[280px] flex-col items-center justify-center gap-4 p-8 text-center`}>
                <div className={`${paperTapeClass} left-1/2 -translate-x-1/2 rotate-[-2deg]`} />
                <AlertCircle className="h-10 w-10 text-destructive" />
                <div>
                  <p className="text-base font-semibold text-foreground">
                    Import failed
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {errorMsg}
                  </p>
                </div>
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
                    onClick={
                      extracted
                        ? () => setPhase("preview")
                        : hasAnalyzeInput
                          ? analyze
                          : reset
                    }
                    className="bg-primary text-white hover:bg-primary/90"
                  >
                    {extracted
                      ? "Back to Review"
                      : hasAnalyzeInput
                        ? "Try Again"
                        : "Start Over"}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
