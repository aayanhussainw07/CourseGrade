"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  Download,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GradeScaleEditor } from "@/components/grade-scale-editor";
import { saveAppSettings, type AppSettings } from "@/lib/app-settings";
import { DEFAULT_GRADE_SCALE } from "@/lib/types";

interface SettingsPageProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  onExportData: () => void;
  hasExportData: boolean;
  onClearAllData: () => Promise<void>;
  userEmail?: string;
  userId?: string;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function SettingsPage({
  settings,
  onSettingsChange,
  onExportData,
  hasExportData,
  onClearAllData,
  userEmail,
  userId,
}: SettingsPageProps) {
  const [localSettings, setLocalSettings] = useState(settings);
  const settingsRef = useRef(settings);
  const [creditsDraft, setCreditsDraft] = useState(
    String(settings.defaultCredits),
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveVersionRef = useRef(0);
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [clearStep, setClearStep] = useState<"idle" | "confirm">("idle");
  const [clearing, setClearing] = useState(false);
  const [dataNotice, setDataNotice] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    settingsRef.current = settings;
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    setCreditsDraft(String(localSettings.defaultCredits));
  }, [localSettings.defaultCredits]);

  useEffect(
    () => () => {
      if (saveStatusTimerRef.current) {
        clearTimeout(saveStatusTimerRef.current);
      }
    },
    [],
  );

  const persist = async (updates: Partial<AppSettings>) => {
    const version = ++saveVersionRef.current;
    if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
    setSaveStatus("saving");
    try {
      await saveAppSettings(updates);
      if (version !== saveVersionRef.current) return;
      setSaveStatus("saved");
      saveStatusTimerRef.current = setTimeout(() => {
        if (version === saveVersionRef.current) setSaveStatus("idle");
      }, 2200);
    } catch {
      if (version === saveVersionRef.current) setSaveStatus("error");
    }
  };

  const updateMany = (updates: Partial<AppSettings>) => {
    const next = { ...settingsRef.current, ...updates };
    settingsRef.current = next;
    setLocalSettings(next);
    onSettingsChange(next);
    void persist(updates);
  };

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    updateMany({ [key]: value });

  const commitCredits = () => {
    const parsed = Number.parseFloat(creditsDraft.trim());
    const clamped =
      Number.isFinite(parsed) && parsed >= 1
        ? Math.min(Number.parseFloat(parsed.toFixed(2)), 20)
        : localSettings.defaultCredits;
    setCreditsDraft(String(clamped));
    if (clamped !== localSettings.defaultCredits) {
      update("defaultCredits", clamped);
    }
  };

  const defaultPassFailSettings = {
    passLabel: (localSettings.defaultPassLabel ?? "P").trim() || "P",
    failLabel: (localSettings.defaultFailLabel ?? "F").trim() || "F",
    threshold: Math.min(
      100,
      Math.max(0, localSettings.defaultPassThreshold ?? 60),
    ),
  };

  const handleClearAll = async () => {
    setClearing(true);
    setDataNotice(null);
    try {
      await onClearAllData();
      setDataNotice({
        kind: "success",
        message: "All semesters and courses were deleted.",
      });
    } catch (error) {
      setDataNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Your data could not be cleared. Please try again.",
      });
    } finally {
      setClearing(false);
      setClearStep("idle");
    }
  };

  const handleExportData = () => {
    setDataNotice(null);
    try {
      onExportData();
      setDataNotice({
        kind: "success",
        message: "CSV export downloaded.",
      });
    } catch (error) {
      setDataNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Your data could not be exported. Please try again.",
      });
    }
  };

  const sectionClass = "py-8 text-foreground first:pt-0 last:pb-0";
  const sectionTitleClass =
    "mb-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground";
  const settingRowClass =
    "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between";
  const switchClass = (enabled: boolean) =>
    `relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-primary/20 transition-colors ${
      enabled ? "bg-primary" : "bg-white"
    }`;

  return (
    <div className="-mx-4 -mt-8">
      <section
        data-nav-tone="light"
        className="bg-background px-4 pb-7 pt-14 sm:pb-9"
      >
        <div className="mx-auto w-full max-w-[1200px]">
          <h1 className="sr-only">Settings</h1>
          <div className="divide-y divide-primary/20">
            <section className={`${sectionClass} space-y-5`}>
              <div className="flex min-h-5 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Course Defaults
                </h2>
                <div
                  className="text-sm text-muted-foreground"
                  role="status"
                  aria-live="polite"
                >
                  {saveStatus === "saving" && (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                    </span>
                  )}
                  {saveStatus === "saved" && (
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" /> Saved
                    </span>
                  )}
                  {saveStatus === "error" && (
                    <span className="flex items-center gap-2 text-destructive">
                      <CloudOff className="h-4 w-4" /> Saved on this device;
                      sync failed.
                    </span>
                  )}
                </div>
              </div>
              <div className={settingRowClass}>
                <div>
                  <Label
                    htmlFor="default-credits"
                    className="text-sm font-medium"
                  >
                    Default credits
                  </Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Used when you create a new course.
                  </p>
                </div>
                <Input
                  id="default-credits"
                  type="text"
                  inputMode="decimal"
                  value={creditsDraft}
                  onChange={(event) => setCreditsDraft(event.target.value)}
                  onBlur={commitCredits}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                  className="w-24 border-2 border-primary/20 bg-white text-center"
                />
              </div>

              <div className="border-t border-primary/15 pt-5">
                <div className={settingRowClass}>
                  <div>
                    <p
                      id="default-grading-mode-label"
                      className="text-sm font-medium"
                    >
                      Default grading mode
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Used when you create a new course.
                    </p>
                  </div>
                  <div
                    role="radiogroup"
                    aria-labelledby="default-grading-mode-label"
                    className="flex overflow-hidden rounded-lg border border-primary/25 bg-white text-sm font-medium"
                  >
                    {[
                      { label: "Letter grade", value: false },
                      { label: "Pass/fail", value: true },
                    ].map((option) => {
                      const selected =
                        localSettings.defaultIsPassFail === option.value;
                      return (
                        <button
                          key={option.label}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() =>
                            update("defaultIsPassFail", option.value)
                          }
                          className={`px-4 py-2 transition-colors ${
                            selected
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-primary/5 hover:text-foreground"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="border-t border-primary/15 pt-5">
                <div className="mb-4">
                  <p className="text-sm font-medium">Pass/fail defaults</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Used by new pass/fail courses. These courses do not count
                    toward GPA.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label
                      htmlFor="default-pass-label"
                      className="text-xs text-muted-foreground"
                    >
                      Pass label
                    </Label>
                    <Input
                      id="default-pass-label"
                      value={defaultPassFailSettings.passLabel}
                      onChange={(event) =>
                        update("defaultPassLabel", event.target.value)
                      }
                      placeholder="P"
                      className="border-2 border-primary/20 bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="default-fail-label"
                      className="text-xs text-muted-foreground"
                    >
                      Fail label
                    </Label>
                    <Input
                      id="default-fail-label"
                      value={defaultPassFailSettings.failLabel}
                      onChange={(event) =>
                        update("defaultFailLabel", event.target.value)
                      }
                      placeholder="F"
                      className="border-2 border-primary/20 bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="default-pass-threshold"
                      className="text-xs text-muted-foreground"
                    >
                      Minimum % to pass
                    </Label>
                    <Input
                      id="default-pass-threshold"
                      type="number"
                      min="0"
                      max="100"
                      value={defaultPassFailSettings.threshold}
                      onChange={(event) => {
                        const parsed = Number.parseFloat(event.target.value);
                        update(
                          "defaultPassThreshold",
                          Math.min(
                            100,
                            Math.max(0, Number.isNaN(parsed) ? 0 : parsed),
                          ),
                        );
                      }}
                      className="border-2 border-primary/20 bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-primary/15 pt-5">
                <p className="mb-4 text-sm font-medium">
                  Default letter-grade scale
                </p>
                <GradeScaleEditor
                  mode="letter-only"
                  gradeScale={localSettings.defaultGradeScale}
                  onUpdate={(scale) => update("defaultGradeScale", scale)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 border-primary/25 bg-white text-xs"
                  onClick={() =>
                    updateMany({
                      defaultGradeScale: DEFAULT_GRADE_SCALE.map((grade) => ({
                        ...grade,
                      })),
                    })
                  }
                >
                  Reset grade scale
                </Button>
              </div>
            </section>

            <section className={`${sectionClass} space-y-5`}>
              <h2 className={sectionTitleClass}>Behavior</h2>
              <div className={settingRowClass}>
                <div>
                  <p
                    id="course-open-state-label"
                    className="text-sm font-medium"
                  >
                    Courses on semester open
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Choose how courses appear whenever you open a semester.
                  </p>
                </div>
                <div
                  role="radiogroup"
                  aria-labelledby="course-open-state-label"
                  className="flex overflow-hidden rounded-lg border border-primary/25 bg-white text-sm font-medium"
                >
                  {[
                    { label: "Collapse", value: true },
                    { label: "Expand", value: false },
                  ].map((option) => {
                    const selected =
                      localSettings.collapseCoursesOnSemesterOpen ===
                      option.value;
                    return (
                      <button
                        key={option.label}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() =>
                          update(
                            "collapseCoursesOnSemesterOpen",
                            option.value,
                          )
                        }
                        className={`px-4 py-2 transition-colors ${
                          selected
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-primary/5 hover:text-foreground"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="border-t border-primary/10 pt-5">
                <div className={settingRowClass}>
                  <div>
                    <p
                      id="skip-semester-delete-confirm-label"
                      className="text-sm font-medium"
                    >
                      Skip semester delete confirmation
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Delete semesters without an extra prompt.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={localSettings.skipSemesterDeleteConfirm}
                    aria-labelledby="skip-semester-delete-confirm-label"
                    onClick={() =>
                      update(
                        "skipSemesterDeleteConfirm",
                        !localSettings.skipSemesterDeleteConfirm,
                      )
                    }
                    className={switchClass(
                      localSettings.skipSemesterDeleteConfirm,
                    )}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white transition-transform ${
                        localSettings.skipSemesterDeleteConfirm
                          ? "translate-x-5"
                          : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
              <div className="border-t border-primary/10 pt-5">
                <div className={settingRowClass}>
                  <div>
                    <p
                      id="skip-course-delete-confirm-label"
                      className="text-sm font-medium"
                    >
                      Skip course delete confirmation
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Delete courses without an extra prompt.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={localSettings.skipCourseDeleteConfirm}
                    aria-labelledby="skip-course-delete-confirm-label"
                    onClick={() =>
                      update(
                        "skipCourseDeleteConfirm",
                        !localSettings.skipCourseDeleteConfirm,
                      )
                    }
                    className={switchClass(
                      localSettings.skipCourseDeleteConfirm,
                    )}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white transition-transform ${
                        localSettings.skipCourseDeleteConfirm
                          ? "translate-x-5"
                          : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </section>

            <section className={sectionClass}>
              <h2 className={sectionTitleClass}>GPA</h2>
              <div className={settingRowClass}>
                <div>
                  <p id="a-plus-gpa-label" className="text-sm font-medium">
                    A+ counts as…
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Some schools treat A+ the same as A.
                  </p>
                </div>
                <div
                  role="group"
                  aria-labelledby="a-plus-gpa-label"
                  className="flex overflow-hidden rounded-lg border border-primary/25 bg-white text-sm font-medium"
                >
                  {([4.0, 4.33] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={
                        Math.abs(localSettings.aPlusGpaValue - value) < 0.01
                      }
                      onClick={() =>
                        update("aPlusGpaValue", value === 4.33 ? 4.33 : 4.0)
                      }
                      className={`px-5 py-2 transition-colors ${
                        Math.abs(localSettings.aPlusGpaValue - value) < 0.01
                          ? "bg-primary text-primary-foreground"
                          : "bg-transparent text-foreground hover:bg-primary/10"
                      }`}
                    >
                      {value.toFixed(2)}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {(userEmail || userId) && (
              <section className={`${sectionClass} space-y-3`}>
                <h2 className={sectionTitleClass}>Account</h2>
                {userEmail && (
                  <div className="flex flex-col gap-1 border-b border-primary/10 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span className="max-w-full truncate font-medium sm:max-w-[65%] sm:text-right">
                      {userEmail}
                    </span>
                  </div>
                )}
                {userId && (
                  <div className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-muted-foreground">User ID</span>
                    <span className="max-w-full truncate font-mono text-xs text-muted-foreground sm:max-w-[65%] sm:text-right">
                      {userId}
                    </span>
                  </div>
                )}
              </section>
            )}

            <section className={`${sectionClass} space-y-4`}>
              <h2 className={sectionTitleClass}>Data</h2>
              {dataNotice && (
                <div
                  role={dataNotice.kind === "error" ? "alert" : "status"}
                  className={`flex items-center gap-2 py-1 text-sm ${
                    dataNotice.kind === "success"
                      ? "text-emerald-700"
                      : "text-destructive"
                  }`}
                >
                  {dataNotice.message}
                </div>
              )}

              <div className={`${settingRowClass} border-b border-primary/10 pb-4`}>
                <div>
                  <p className="text-sm font-medium">Export all grades</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Download every semester&apos;s courses, criteria, weights,
                    and current grades as one CSV.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 bg-white"
                  onClick={handleExportData}
                  disabled={!hasExportData}
                >
                  <Download className="h-4 w-4" /> Export CSV
                </Button>
              </div>

              {clearStep === "idle" ? (
                <div className={settingRowClass}>
                  <div>
                    <p className="text-sm font-medium">Clear all data</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Permanently delete all semesters and courses.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 border-destructive/40 bg-white text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setDataNotice(null);
                      setClearStep("confirm");
                    }}
                  >
                    Clear data
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 border-l-2 border-destructive/40 pl-4">
                  <div className="flex items-start gap-2 text-destructive">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">Are you sure?</p>
                      <p className="mt-0.5 text-xs text-destructive/80">
                        This permanently deletes every semester and course and
                        cannot be undone.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-white sm:min-w-28"
                      onClick={() => setClearStep("idle")}
                      disabled={clearing}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="sm:min-w-44"
                      onClick={handleClearAll}
                      disabled={clearing}
                    >
                      {clearing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Deleting…
                        </>
                      ) : (
                        "Yes, delete everything"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </section>
    </div>
  );
}
