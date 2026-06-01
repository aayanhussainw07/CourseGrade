"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GradeScaleEditor } from "@/components/grade-scale-editor";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  loadAppSettings,
  saveAppSettings,
  type AppSettings,
} from "@/lib/app-settings";
import { DEFAULT_GRADE_SCALE, type GradeScale } from "@/lib/types";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  onClearAllData: () => Promise<void>;
  userEmail?: string;
  userId?: string;
}

export function SettingsDialog({
  open,
  onClose,
  onClearAllData,
  userEmail,
  userId,
}: SettingsDialogProps) {
  const [settings, setSettings] = useState<AppSettings>(loadAppSettings);
  const [creditsDraft, setCreditsDraft] = useState(
    String(settings.defaultCredits),
  );
  const [clearStep, setClearStep] = useState<"idle" | "confirm">("idle");
  const [clearing, setClearing] = useState(false);
  const [gradeScaleOpen, setGradeScaleOpen] = useState(false);

  // Reload settings when dialog opens
  useEffect(() => {
    if (open) {
      const loaded = loadAppSettings();
      setSettings(loaded);
      setCreditsDraft(String(loaded.defaultCredits));
      setClearStep("idle");
    }
  }, [open]);

  const update = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveAppSettings({ [key]: value });
  };

  const commitCredits = () => {
    const parsed = Number.parseFloat(creditsDraft.trim());
    const clamped =
      Number.isFinite(parsed) && parsed >= 1
        ? Math.min(Number.parseFloat(parsed.toFixed(2)), 20)
        : settings.defaultCredits;
    setCreditsDraft(String(clamped));
    update("defaultCredits", clamped);
  };

  const handleClearAll = async () => {
    setClearing(true);
    try {
      await onClearAllData();
      onClose();
    } finally {
      setClearing(false);
      setClearStep("idle");
    }
  };

  const paperSectionClass =
    "relative overflow-hidden rounded-lg border border-primary/25 bg-white/50 p-4";
  const paperTapeClass =
    "pointer-events-none absolute -top-2 h-5 w-16 bg-primary/12";
  const sectionTitleClass =
    "mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground";
  const settingRowClass =
    "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between";
  const defaultPassFailSettings = {
    passLabel: (settings.defaultPassLabel ?? "P").trim() || "P",
    failLabel: (settings.defaultFailLabel ?? "F").trim() || "F",
    threshold: Math.min(100, Math.max(0, settings.defaultPassThreshold ?? 60)),
  };
  const buildPassFailScale = (passFailSettings: typeof defaultPassFailSettings): GradeScale[] => [
    { letter: passFailSettings.passLabel, min: passFailSettings.threshold },
    { letter: passFailSettings.failLabel, min: 0 },
  ];
  const updateMany = (updates: Partial<AppSettings>) => {
    const next = { ...settings, ...updates };
    setSettings(next);
    saveAppSettings(updates);
  };
  const updateDefaultPassFail = (value: boolean) => {
    if (value) {
      updateMany({
        defaultIsPassFail: true,
        defaultGradeScaleSnapshot:
          settings.defaultGradeScaleSnapshot ?? settings.defaultGradeScale.map((grade) => ({ ...grade })),
        defaultGradeScale: buildPassFailScale(defaultPassFailSettings),
      });
      return;
    }

    updateMany({
      defaultIsPassFail: false,
      defaultGradeScale:
        settings.defaultGradeScaleSnapshot?.map((grade) => ({ ...grade })) ??
        DEFAULT_GRADE_SCALE.map((grade) => ({ ...grade })),
      defaultGradeScaleSnapshot: undefined,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent
        className="max-h-[85vh] max-w-2xl overflow-hidden border-2 border-primary/25 bg-[#fff8f1] p-0 text-foreground ![box-shadow:none] [&_*]:![box-shadow:none]"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="relative border-b border-primary/20 bg-[#fff3ea] px-6 pb-4 pt-6">
          <div className={`${paperTapeClass} left-10 rotate-[-2deg]`} />
          <DialogTitle className="font-heading text-lg tracking-widest text-primary">
            Settings
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Defaults, behavior, and account controls.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(85vh-92px)] space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
          {/* Course Defaults */}
          <section className={`${paperSectionClass} space-y-4`}>
            <div className={`${paperTapeClass} right-10 rotate-2`} />
            <h3 className={sectionTitleClass}>
              Course Defaults
            </h3>

            <div className={settingRowClass}>
              <Label htmlFor="default-credits" className="text-sm">
                Default Credits
              </Label>
              <Input
                id="default-credits"
                type="text"
                inputMode="decimal"
                value={creditsDraft}
                onChange={(e) => setCreditsDraft(e.target.value)}
                onBlur={commitCredits}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                className="w-20 border-2 border-primary/20 bg-[#fff8f1] text-center"
              />
            </div>

            <div className="rounded-lg border border-primary/20 bg-[#fff8f1]/70 p-3">
              <button
                type="button"
                onClick={() => setGradeScaleOpen((p) => !p)}
                className="flex w-full items-center justify-between gap-4 text-left"
              >
                <div>
                  <p className="text-sm font-medium">Default Grade Scale</p>
                  <p className="text-xs text-muted-foreground">
                    Applied to every new course.
                  </p>
                </div>
                {gradeScaleOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>
              {gradeScaleOpen && (
                <div className="mt-3 space-y-3 border-t border-primary/15 pt-3">
                  <div className="rounded-lg border border-primary/20 bg-white/45 p-3">
                    <GradeScaleEditor
                      gradeScale={settings.defaultGradeScale}
                      onUpdate={(scale) => update("defaultGradeScale", scale)}
                      isPassFail={settings.defaultIsPassFail}
                      onPassFailChange={updateDefaultPassFail}
                      passFailSettings={defaultPassFailSettings}
                      onPassFailSettingsChange={(passFailSettings) =>
                        updateMany({
                          defaultPassLabel: passFailSettings.passLabel,
                          defaultFailLabel: passFailSettings.failLabel,
                          defaultPassThreshold: passFailSettings.threshold,
                        })
                      }
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-primary/25 bg-[#fff8f1] text-xs"
                    onClick={() =>
                      updateMany({
                        defaultGradeScale: DEFAULT_GRADE_SCALE.map((g) => ({ ...g })),
                        defaultGradeScaleSnapshot: undefined,
                        defaultIsPassFail: false,
                        defaultPassLabel: "P",
                        defaultFailLabel: "F",
                        defaultPassThreshold: 60,
                      })
                    }
                  >
                    Reset to default
                  </Button>
                </div>
              )}
            </div>
          </section>

          {/* Behavior */}
          <section className={paperSectionClass}>
            <div className={`${paperTapeClass} left-8 rotate-[-2deg]`} />
            <h3 className={sectionTitleClass}>
              Behavior
            </h3>
            <div className={settingRowClass}>
              <div>
                <p id="skip-semester-delete-confirm-label" className="text-sm font-medium">
                  Skip semester delete confirmation
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Delete semesters without a confirmation prompt.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.skipSemesterDeleteConfirm}
                aria-labelledby="skip-semester-delete-confirm-label"
                onClick={() => update("skipSemesterDeleteConfirm", !settings.skipSemesterDeleteConfirm)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-primary/20 transition-colors ${settings.skipSemesterDeleteConfirm ? "bg-primary" : "bg-[#fff8f1]"}`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white transition-transform ${settings.skipSemesterDeleteConfirm ? "translate-x-4" : "translate-x-0"}`} />
              </button>
            </div>
          </section>

          {/* GPA */}
          <section className={paperSectionClass}>
            <div className={`${paperTapeClass} right-12 rotate-3`} />
            <h3 className={sectionTitleClass}>
              GPA
            </h3>

            <div className={settingRowClass}>
              <div>
                <p id="a-plus-gpa-label" className="text-sm font-medium">
                  A+ counts as...
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Some schools treat A+ the same as A.
                </p>
              </div>
              <div
                role="group"
                aria-labelledby="a-plus-gpa-label"
                className="flex overflow-hidden rounded-lg border border-primary/25 bg-[#fff8f1] text-sm font-medium"
              >
                {([4.0, 4.33] as const).map((val) => (
                  <button
                    key={val}
                    type="button"
                    aria-pressed={Math.abs(settings.aPlusGpaValue - val) < 0.01}
                    onClick={() =>
                      update("aPlusGpaValue", val === 4.33 ? 4.33 : 4.0)
                    }
                    className={`px-4 py-1.5 transition-colors ${
                      Math.abs(settings.aPlusGpaValue - val) < 0.01
                        ? "bg-primary text-primary-foreground"
                        : "bg-transparent text-foreground hover:bg-primary/10"
                    }`}
                  >
                    {val.toFixed(2)}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Account */}
          {(userEmail || userId) && (
            <section className={`${paperSectionClass} space-y-3`}>
              <div className={`${paperTapeClass} left-12 rotate-2`} />
              <h3 className={sectionTitleClass}>
                Account
              </h3>
              {userEmail && (
                <div className="flex flex-col gap-1 rounded-md border border-primary/15 bg-[#fff8f1]/70 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="max-w-full truncate font-medium sm:max-w-[60%] sm:text-right">
                    {userEmail}
                  </span>
                </div>
              )}
              {userId && (
                <div className="flex flex-col gap-1 rounded-md border border-primary/15 bg-[#fff8f1]/70 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-muted-foreground">User ID</span>
                  <span className="max-w-full truncate font-mono text-xs text-muted-foreground sm:max-w-[60%] sm:text-right">
                    {userId}
                  </span>
                </div>
              )}
            </section>
          )}

          {/* Data */}
          <section className={`${paperSectionClass} space-y-3`}>
            <div className={`${paperTapeClass} right-8 rotate-[-2deg]`} />
            <h3 className={sectionTitleClass}>
              Data
            </h3>

            {clearStep === "idle" ? (
              <div className={settingRowClass}>
                <div>
                  <p className="text-sm font-medium">Clear All Data</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Permanently delete all semesters and courses.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-destructive/40 bg-[#fff8f1] text-destructive hover:bg-destructive/10"
                  onClick={() => setClearStep("confirm")}
                >
                  Clear Data
                </Button>
              </div>
            ) : (
              <div className="relative space-y-3 overflow-hidden rounded-lg border-2 border-destructive/40 bg-destructive/5 p-4">
                <div className="pointer-events-none absolute -top-2 left-8 h-5 w-16 rotate-[-2deg] bg-destructive/15" />
                <div className="flex items-start gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">Are you sure?</p>
                    <p className="text-xs mt-0.5 text-destructive/80">
                      This will permanently delete all your semesters and
                      courses. This cannot be undone.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 bg-[#fff8f1]"
                    onClick={() => setClearStep("idle")}
                    disabled={clearing}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    onClick={handleClearAll}
                    disabled={clearing}
                  >
                    {clearing ? "Deleting…" : "Yes, delete everything"}
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
