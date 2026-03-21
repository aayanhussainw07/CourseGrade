"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GradeScaleEditor } from "@/components/grade-scale-editor";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { loadAppSettings, saveAppSettings, type AppSettings } from "@/lib/app-settings";
import { DEFAULT_GRADE_SCALE } from "@/lib/types";
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
  const [creditsDraft, setCreditsDraft] = useState(String(settings.defaultCredits));
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

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveAppSettings({ [key]: value });
  };

  const commitCredits = () => {
    const parsed = parseInt(creditsDraft.trim(), 10);
    const clamped = !isNaN(parsed) && parsed >= 1 ? Math.min(parsed, 20) : settings.defaultCredits;
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

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg tracking-widest">Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-8 py-2">

          {/* Course Defaults */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Course Defaults</h3>

            <div className="flex items-center justify-between">
              <Label className="text-sm">Default Credits</Label>
              <Input
                type="text"
                inputMode="numeric"
                value={creditsDraft}
                onChange={(e) => setCreditsDraft(e.target.value)}
                onBlur={commitCredits}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                className="w-20 text-center"
              />
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setGradeScaleOpen((p) => !p)}
                className="flex w-full items-center justify-between text-left"
              >
                <div>
                  <p className="text-sm font-medium">Default Grade Scale</p>
                  <p className="text-xs text-muted-foreground">Applied to every new course.</p>
                </div>
                {gradeScaleOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </button>
              {gradeScaleOpen && (
                <div className="space-y-2 pt-1">
                  <div className="rounded-lg border border-border/60 p-3">
                    <GradeScaleEditor
                      gradeScale={settings.defaultGradeScale}
                      onUpdate={(scale) => update("defaultGradeScale", scale)}
                      isPassFail={false}
                      onPassFailChange={() => {}}
                      passFailSettings={{ passLabel: "P", failLabel: "F", threshold: 60 }}
                      onPassFailSettingsChange={() => {}}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => update("defaultGradeScale", DEFAULT_GRADE_SCALE.map((g) => ({ ...g })))}
                  >
                    Reset to default
                  </Button>
                </div>
              )}
            </div>
          </section>

          {/* GPA */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">GPA</h3>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">A+ Grade Points</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Some schools treat A+ the same as A.</p>
              </div>
              <div className="flex rounded-lg border border-border overflow-hidden text-sm font-medium">
                {([4.0, 4.33] as const).map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => update("aPlusGpaValue", val === 4.33 ? 4.33 : 4.0)}
                    className={`px-4 py-1.5 transition-colors ${
                      Math.abs(settings.aPlusGpaValue - val) < 0.01
                        ? "bg-primary text-primary-foreground"
                        : "bg-transparent text-foreground hover:bg-muted"
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
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Account</h3>
              {userEmail && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium truncate max-w-[60%] text-right">{userEmail}</span>
                </div>
              )}
              {userId && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">User ID</span>
                  <span className="font-mono text-xs text-muted-foreground truncate max-w-[60%] text-right">{userId}</span>
                </div>
              )}
            </section>
          )}

          {/* Data */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Data</h3>

            {clearStep === "idle" ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Clear All Data</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Permanently delete all semesters and courses.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={() => setClearStep("confirm")}
                >
                  Clear Data
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border-2 border-destructive/40 bg-destructive/5 p-4 space-y-3">
                <div className="flex items-start gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">Are you sure?</p>
                    <p className="text-xs mt-0.5 text-destructive/80">This will permanently delete all your semesters and courses. This cannot be undone.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
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
