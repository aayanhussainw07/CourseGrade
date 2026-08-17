"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  CloudOff,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { GradeScaleEditor } from "@/components/grade-scale-editor"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AppSettings } from "@/lib/app-settings"
import {
  SETTINGS_ONBOARDING_STEPS,
  type SettingsOnboardingStep,
} from "@/lib/onboarding"
import { DEFAULT_GRADE_SCALE } from "@/lib/types"

interface OnboardingSettingsWizardProps {
  step: SettingsOnboardingStep
  settings: AppSettings
  onSettingsUpdate: (updates: Partial<AppSettings>) => Promise<void>
  onBack: () => void
  onNext: () => void
  onSkip: () => void
}

type SaveStatus = "idle" | "saving" | "saved" | "error"

const STEP_CONTENT: Record<
  SettingsOnboardingStep,
  { title: string; body: string }
> = {
  settings_credits: {
    title: "How many credits is a typical course?",
    body: "New courses will start with this value. You can always change credits on an individual course.",
  },
  settings_grade_scale: {
    title: "Match your letter-grade scale",
    body: "Set each label, cutoff, GPA value, and color. New courses inherit this scale and remain independently editable.",
  },
  settings_course_behavior: {
    title: "How should courses open?",
    body: "Choose the starting view whenever you enter a semester. You can still open or close individual course cards anytime.",
  },
}

export function OnboardingSettingsWizard({
  step,
  settings,
  onSettingsUpdate,
  onBack,
  onNext,
  onSkip,
}: OnboardingSettingsWizardProps) {
  const reduceMotion = useReducedMotion()
  const [creditsDraft, setCreditsDraft] = useState(
    String(settings.defaultCredits),
  )
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const saveVersionRef = useRef(0)
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const stepIndex = SETTINGS_ONBOARDING_STEPS.indexOf(step)
  const copy = STEP_CONTENT[step]

  useEffect(() => {
    setCreditsDraft(String(settings.defaultCredits))
  }, [settings.defaultCredits])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [step])

  useEffect(
    () => () => {
      if (saveStatusTimerRef.current) {
        clearTimeout(saveStatusTimerRef.current)
      }
    },
    [],
  )

  const persist = async (updates: Partial<AppSettings>) => {
    const version = ++saveVersionRef.current
    if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current)
    setSaveStatus("saving")
    try {
      await onSettingsUpdate(updates)
      if (version !== saveVersionRef.current) return
      setSaveStatus("saved")
      saveStatusTimerRef.current = setTimeout(() => {
        if (version === saveVersionRef.current) setSaveStatus("idle")
      }, 1800)
    } catch {
      if (version === saveVersionRef.current) setSaveStatus("error")
    }
  }

  const commitCredits = () => {
    const parsed = Number.parseFloat(creditsDraft.trim())
    const nextCredits =
      Number.isFinite(parsed) && parsed >= 1
        ? Math.min(Number.parseFloat(parsed.toFixed(2)), 20)
        : settings.defaultCredits
    setCreditsDraft(String(nextCredits))
    if (nextCredits !== settings.defaultCredits) {
      void persist({ defaultCredits: nextCredits })
    }
  }

  const continueFlow = () => {
    if (step === "settings_credits") commitCredits()
    onNext()
  }

  const renderStep = () => {
    if (step === "settings_credits") {
      return (
        <div className="mx-auto flex max-w-md flex-col items-center py-4 text-center sm:py-8">
          <Label
            htmlFor="onboarding-default-credits"
            className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-primary/65"
          >
            Default credits
          </Label>
          <Input
            id="onboarding-default-credits"
            type="text"
            inputMode="decimal"
            autoFocus
            value={creditsDraft}
            onChange={(event) => setCreditsDraft(event.target.value)}
            onBlur={commitCredits}
            onKeyDown={(event) => {
              if (event.key === "Enter") continueFlow()
            }}
            className="h-24 w-40 border-2 border-primary/25 bg-white text-center font-futura-bold text-5xl font-black text-primary shadow-sm focus-visible:ring-primary/35"
          />
          <p className="mt-4 text-sm text-muted-foreground">
            Enter a value from 1 to 20.
          </p>
        </div>
      )
    }

    if (step === "settings_grade_scale") {
      return (
        <div>
          <GradeScaleEditor
            mode="letter-only"
            gradeScale={settings.defaultGradeScale}
            onUpdate={(defaultGradeScale) => {
              void persist({ defaultGradeScale })
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-5 border-primary/25 bg-white"
            onClick={() => {
              void persist({
                defaultGradeScale: DEFAULT_GRADE_SCALE.map((grade) => ({
                  ...grade,
                })),
              })
            }}
          >
            Reset to standard scale
          </Button>
        </div>
      )
    }

    return (
      <div
        role="radiogroup"
        aria-label="Course open behavior"
        className="mx-auto grid max-w-2xl gap-4 py-4 sm:grid-cols-2 sm:py-8"
      >
        {[
          {
            label: "Collapsed",
            description: "Scan every course quickly and open details as needed.",
            value: true,
          },
          {
            label: "Expanded",
            description: "See grading details immediately when a semester opens.",
            value: false,
          },
        ].map((option) => {
          const selected =
            settings.collapseCoursesOnSemesterOpen === option.value
          return (
            <button
              key={option.label}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() =>
                void persist({
                  collapseCoursesOnSemesterOpen: option.value,
                })
              }
              className={`relative min-h-40 rounded-lg border-2 p-6 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 ${
                selected
                  ? "border-primary bg-primary text-primary-foreground shadow-[0_12px_25px_rgba(45,0,8,0.2)]"
                  : "border-primary/20 bg-white hover:-translate-y-0.5 hover:border-primary/45"
              }`}
            >
              {selected && (
                <Check className="absolute right-4 top-4 h-5 w-5" />
              )}
              <span className="font-futura-bold text-2xl font-black uppercase tracking-wide">
                {option.label}
              </span>
              <span
                className={`mt-3 block text-sm leading-relaxed ${
                  selected
                    ? "text-primary-foreground/75"
                    : "text-muted-foreground"
                }`}
              >
                {option.description}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-[#f8f1eb] text-foreground">
      <main className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-7 sm:px-8 sm:py-10">
        <div className="mb-4 flex items-center justify-end gap-3">
          <Image
            src="/coursegrade.png"
            alt="CourseGrade"
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
          />
          <div
            className="flex w-32 gap-1.5 sm:w-48"
            role="progressbar"
            aria-label="Settings setup progress"
            aria-valuemin={1}
            aria-valuemax={SETTINGS_ONBOARDING_STEPS.length}
            aria-valuenow={stepIndex + 1}
          >
            {SETTINGS_ONBOARDING_STEPS.map((item, index) => (
              <span
                key={item}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  index <= stepIndex ? "bg-primary" : "bg-primary/15"
                }`}
              />
            ))}
          </div>
        </div>

        <section className="relative flex flex-1 flex-col">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={reduceMotion ? false : { opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, x: -14 }}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}
              className="flex flex-1 flex-col"
            >
              <div className="w-full pt-[clamp(1.5rem,3vh,3rem)]">
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="font-futura-bold text-3xl font-black uppercase leading-none outline-none md:whitespace-nowrap md:text-[clamp(1.75rem,3.4vw,2.75rem)]"
                >
                  {copy.title}
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {copy.body}
                </p>
              </div>

              <div className="my-auto py-6">{renderStep()}</div>
            </motion.div>
          </AnimatePresence>

          <footer className="mt-4 flex flex-col-reverse gap-4 border-t-2 border-dashed border-primary/15 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={onBack}
              disabled={stepIndex === 0}
              className="gap-2 self-start disabled:invisible"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div
                role="status"
                aria-live="polite"
                className="min-h-5 text-xs text-muted-foreground"
              >
                {saveStatus === "saving" && (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                  </span>
                )}
                {saveStatus === "saved" && (
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Saved
                  </span>
                )}
                {saveStatus === "error" && (
                  <span className="flex items-center gap-1.5 text-destructive">
                    <CloudOff className="h-3.5 w-3.5" /> Saved on this device
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" onClick={onSkip}>
                  Skip
                </Button>
                <Button
                  type="button"
                  onClick={continueFlow}
                  className="min-w-36 gap-2"
                >
                  {stepIndex === SETTINGS_ONBOARDING_STEPS.length - 1
                    ? "Start app tour"
                    : "Continue"}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </footer>
        </section>
      </main>
    </div>
  )
}
