"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Check, ChevronRight, Pause, RotateCcw, X } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import type { Semester } from "@/lib/types"
import {
  DEFAULT_ONBOARDING_PROGRESS,
  isAutomaticOnboardingEligible,
  isFirstCriterionConfigured,
  type CoreOnboardingStep,
  type OnboardingProgress,
} from "@/lib/onboarding"

interface OnboardingTourProps {
  progress: OnboardingProgress
  onProgressChange: (progress: OnboardingProgress) => void
  launchNonce: number | null
  authenticated: boolean
  settingsLoaded: boolean
  dataLoaded: boolean
  serverOffline: boolean
  semesters: Semester[]
  activeSemesterId: string | null
  sidebarOpen: boolean
}

interface StepPresentation {
  title: string
  body: string
  selector: string | null
  hint?: string
}

const CORE_ORDER: CoreOnboardingStep[] = [
  "welcome",
  "add_semester",
  "rename_semester",
  "add_course",
  "open_course",
  "customize_course",
  "add_criterion",
  "configure_criterion",
  "grade_result",
  "navigation",
  "dashboard_link",
  "dashboard_finish",
]

const selectorForCourse = (courseId: string | undefined, target?: string) => {
  if (!courseId) return null
  const safeId = courseId.replace(/["\\]/g, "")
  const base = `[data-onboarding-course-id="${safeId}"]`
  return target ? `${base} [data-onboarding-target="${target}"]` : base
}

function getCorePresentation(
  step: CoreOnboardingStep,
  progress: OnboardingProgress,
  mobile: boolean,
  sidebarOpen: boolean,
): StepPresentation {
  switch (step) {
    case "welcome":
      return {
        title: "Welcome to CourseGrade",
        body: "Let’s build your first semester, course, and weighted grade together. It takes about two minutes.",
        selector: null,
      }
    case "add_semester":
      return {
        title: "Start with a semester",
        body: progress.coreSetupRequired
          ? "Create the semester you want to track first."
          : "This is where a new term begins. You can continue with an existing semester for this replay.",
        selector: '[data-onboarding-target="add-semester-main"]',
        hint: progress.coreSetupRequired ? "Select Add Semester to continue" : undefined,
      }
    case "rename_semester":
      return {
        title: "Make it yours",
        body: "Select the semester title and give it a useful name, such as Fall 2026.",
        selector: '[data-onboarding-target="semester-title"]',
        hint: progress.coreSetupRequired ? "Rename the semester to continue" : undefined,
      }
    case "add_course":
      return {
        title: "Add your first course",
        body: "Courses live inside semesters and roll up into your semester and overall GPA.",
        selector: '[data-onboarding-target="add-course"]',
        hint: "Select Add Course to continue",
      }
    case "open_course":
      return {
        title: "Open the course card",
        body: "Course cards stay compact until you need them. Open this one to set up its details.",
        selector: selectorForCourse(progress.courseId),
        hint: "Select the card to continue",
      }
    case "customize_course":
      return {
        title: "Name your course",
        body: "Replace the generated name and check the credit value. Your default credits can be changed later in Settings.",
        selector: selectorForCourse(progress.courseId, "course-basics"),
        hint: progress.coreSetupRequired ? "Rename the course to continue" : undefined,
      }
    case "add_criterion":
      return {
        title: "Build the grade breakdown",
        body: "Add a weighted category such as Assignments or Exams. For a quick overall grade, use the grade pencil before adding criteria.",
        selector: selectorForCourse(progress.courseId, "add-criterion"),
        hint: "Select Add Criteria to continue",
      }
    case "configure_criterion":
      return {
        title: "Set up the first category",
        body: "Give it a name, a positive weight, and its current score. CourseGrade recalculates as soon as each value is committed.",
        selector: selectorForCourse(progress.courseId, "criterion-row"),
        hint: "Complete name, weight, and score to continue",
      }
    case "grade_result":
      return {
        title: "Your grade stays current",
        body: "The numeric and letter grade update automatically. The weight indicator warns you until all categories total 100%.",
        selector: selectorForCourse(progress.courseId, "grade-result"),
      }
    case "navigation":
      return {
        title: mobile && !sidebarOpen ? "Open your overview" : "Everything stays within reach",
        body: mobile
          ? sidebarOpen
            ? "Use this overview to move between semesters and courses, rename items, and manage your account."
            : "On smaller screens, Overview opens your semester and course navigation."
          : "The sidebar moves between semesters and courses and gives you quick rename, reorder, and GPA controls.",
        selector:
          mobile && !sidebarOpen
            ? '[data-onboarding-target="overview-trigger"]'
            : mobile
              ? '[data-onboarding-target="sidebar-overlay"]'
              : '[data-onboarding-target="sidebar-desktop"]',
        hint: mobile && !sidebarOpen ? "Open Overview to continue" : undefined,
      }
    case "dashboard_link":
      return {
        title: "Return to the big picture",
        body: "Dashboard brings every semester together into one academic overview.",
        selector: '[data-onboarding-target="dashboard-link"]',
        hint: "Select Dashboard to continue",
      }
    case "dashboard_finish":
      return {
        title: "You’re ready",
        body: "Your GPA, credits, trends, and semesters now stay organized here as your courses change.",
        selector: '[data-onboarding-target="dashboard-overview"]',
      }
  }
}

function SpotlightLayer({
  selector,
  children,
}: {
  selector: string | null
  children: React.ReactNode
}) {
  const reduceMotion = useReducedMotion()
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const scrolledSelectorRef = useRef<string | null>(null)

  useEffect(() => {
    let frame = 0
    let resizeObserver: ResizeObserver | null = null
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        setViewport({ width: window.innerWidth, height: window.innerHeight })
        const target = selector
          ? document.querySelector<HTMLElement>(selector)
          : null
        setRect(target?.getBoundingClientRect() ?? null)
        resizeObserver?.disconnect()
        if (target) {
          resizeObserver = new ResizeObserver(update)
          resizeObserver.observe(target)
          if (scrolledSelectorRef.current !== selector) {
            scrolledSelectorRef.current = selector
            target.scrollIntoView({
              behavior: reduceMotion ? "auto" : "smooth",
              block: "center",
              inline: "nearest",
            })
          }
        }
      })
    }
    update()
    const mutationObserver = new MutationObserver(update)
    mutationObserver.observe(document.body, { childList: true, subtree: true })
    window.addEventListener("resize", update)
    window.addEventListener("scroll", update, true)
    return () => {
      cancelAnimationFrame(frame)
      mutationObserver.disconnect()
      resizeObserver?.disconnect()
      window.removeEventListener("resize", update)
      window.removeEventListener("scroll", update, true)
    }
  }, [reduceMotion, selector])

  const pad = 8
  const hole = rect
    ? {
        left: Math.max(0, rect.left - pad),
        top: Math.max(0, rect.top - pad),
        right: Math.min(viewport.width, rect.right + pad),
        bottom: Math.min(viewport.height, rect.bottom + pad),
      }
    : null
  const dimClass = "fixed z-[90] bg-[#2d0008]/20 backdrop-blur-[1px]"
  const tooltipStyle = (() => {
    if (!hole || viewport.width < 640) return undefined
    const width = Math.min(340, viewport.width - 32)
    const left = Math.min(
      viewport.width - width - 16,
      Math.max(16, hole.left + (hole.right - hole.left - width) / 2),
    )
    const estimatedHeight = 230
    const below = hole.bottom + 14
    const top =
      below + estimatedHeight <= viewport.height
        ? below
        : Math.max(16, hole.top - estimatedHeight - 14)
    return { left, top, width }
  })()

  return (
    <>
      {hole ? (
        <>
          <motion.div className={`${dimClass} inset-x-0 top-0`} animate={{ height: hole.top }} />
          <motion.div
            className={dimClass}
            animate={{ left: 0, top: hole.top, width: hole.left, height: hole.bottom - hole.top }}
          />
          <motion.div
            className={dimClass}
            animate={{ left: hole.right, right: 0, top: hole.top, height: hole.bottom - hole.top }}
          />
          <motion.div className={`${dimClass} inset-x-0 bottom-0`} animate={{ top: hole.bottom }} />
          <motion.div
            aria-hidden="true"
            className="pointer-events-none fixed z-[92] rounded-xl ring-2 ring-primary/70 ring-offset-4 ring-offset-transparent"
            animate={{
              left: hole.left,
              top: hole.top,
              width: hole.right - hole.left,
              height: hole.bottom - hole.top,
            }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 30 }}
          />
        </>
      ) : (
        <div className="fixed inset-0 z-[90] bg-[#2d0008]/20 backdrop-blur-[1px]" />
      )}
      <motion.div
        key={selector ?? "centered"}
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
        transition={{ duration: reduceMotion ? 0 : 0.18 }}
        className={
          tooltipStyle
            ? "fixed z-[100]"
            : "fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-sm sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[360px] sm:-translate-x-1/2 sm:-translate-y-1/2"
        }
        style={tooltipStyle}
      >
        {children}
      </motion.div>
    </>
  )
}

export function OnboardingTour({
  progress,
  onProgressChange,
  launchNonce,
  authenticated,
  settingsLoaded,
  dataLoaded,
  serverOffline,
  semesters,
  activeSemesterId,
  sidebarOpen,
}: OnboardingTourProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [active, setActive] = useState(false)
  const [showResume, setShowResume] = useState(false)
  const [confirmSkip, setConfirmSkip] = useState(false)
  const [mobile, setMobile] = useState(false)
  const initialEvaluationRef = useRef(false)
  const launchNonceRef = useRef<number | null>(null)

  const persist = useCallback(
    (updates: Partial<OnboardingProgress>) => {
      onProgressChange({ ...progress, ...updates })
    },
    [onProgressChange, progress],
  )

  const selectedSemester = useMemo(
    () =>
      semesters.find((semester) => semester.id === progress.semesterId) ??
      semesters.find((semester) => semester.id === activeSemesterId) ??
      semesters[0],
    [activeSemesterId, progress.semesterId, semesters],
  )
  const selectedCourse = useMemo(
    () =>
      selectedSemester?.courses.find((course) => course.id === progress.courseId) ??
      selectedSemester?.courses[0],
    [progress.courseId, selectedSemester],
  )

  useEffect(() => {
    const update = () => setMobile(window.innerWidth < 768)
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  const startCore = useCallback(
    (replay: boolean) => {
      const semester = replay ? semesters[0] : undefined
      const course = semester?.courses[0]
      onProgressChange({
        ...DEFAULT_ONBOARDING_PROGRESS,
        coreStatus: "in_progress",
        coreStep: "welcome",
        coreSetupRequired: !replay,
        semesterId: semester?.id,
        courseId: course?.id,
        initialSemesterName: semester?.name,
        initialCourseName: course?.name,
      })
      setShowResume(false)
      setActive(true)
      router.push("/dashboard")
    },
    [onProgressChange, router, semesters],
  )

  useEffect(() => {
    if (launchNonce === null || launchNonceRef.current === launchNonce) return
    launchNonceRef.current = launchNonce
    if (progress.coreStatus === "in_progress") {
      setShowResume(false)
      setActive(true)
    } else {
      startCore(semesters.length > 0)
    }
  }, [
    launchNonce,
    progress.coreStatus,
    semesters.length,
    startCore,
  ])

  useEffect(() => {
    if (!dataLoaded || progress.coreStatus !== "in_progress") return
    const storedSemester = semesters.find(
      (semester) => semester.id === progress.semesterId,
    )
    if (progress.semesterId && !storedSemester) {
      const fallbackSemester = semesters[0]
      persist(
        fallbackSemester
          ? {
              coreStep: fallbackSemester.courses.length > 0
                ? "open_course"
                : "rename_semester",
              coreSetupRequired: false,
              semesterId: fallbackSemester.id,
              courseId: fallbackSemester.courses[0]?.id,
              initialSemesterName: fallbackSemester.name,
              initialCourseName: fallbackSemester.courses[0]?.name,
            }
          : {
              coreStep: "add_semester",
              coreSetupRequired: true,
              semesterId: undefined,
              courseId: undefined,
              initialSemesterName: undefined,
              initialCourseName: undefined,
            },
      )
      return
    }

    if (
      storedSemester &&
      progress.courseId &&
      !storedSemester.courses.some((course) => course.id === progress.courseId)
    ) {
      const fallbackCourse = storedSemester.courses[0]
      persist(
        fallbackCourse
          ? {
              coreStep: "open_course",
              coreSetupRequired: false,
              courseId: fallbackCourse.id,
              initialCourseName: fallbackCourse.name,
            }
          : {
              coreStep: "add_course",
              coreSetupRequired: true,
              courseId: undefined,
              initialCourseName: undefined,
              criterionScoreEntered: false,
            },
      )
    }
  }, [dataLoaded, persist, progress, semesters])

  useEffect(() => {
    if (
      initialEvaluationRef.current ||
      !authenticated ||
      !settingsLoaded ||
      !dataLoaded ||
      serverOffline
    ) {
      return
    }
    initialEvaluationRef.current = true
    if (progress.coreStatus === "in_progress") {
      setShowResume(true)
      return
    }
    if (
      isAutomaticOnboardingEligible({
        authenticated,
        settingsLoaded,
        dataLoaded,
        serverOffline,
        semesterCount: semesters.length,
        progress,
      })
    ) {
      startCore(false)
    }
  }, [
    authenticated,
    dataLoaded,
    progress,
    semesters.length,
    serverOffline,
    settingsLoaded,
    startCore,
  ])

  useEffect(() => {
    if (!active) return
    if (progress.coreStep === "add_semester" && progress.coreSetupRequired) {
      const semester =
        semesters.find((item) => item.id === activeSemesterId) ?? semesters.at(-1)
      if (semester) {
        persist({
          coreStep: "rename_semester",
          semesterId: semester.id,
          initialSemesterName: semester.name,
        })
      }
    }
    if (progress.coreStep === "add_course") {
      const semester = selectedSemester
      const course = semester?.courses.at(-1)
      if (course && course.id !== progress.courseId) {
        persist({
          coreStep: "open_course",
          courseId: course.id,
          initialCourseName: course.name,
          criterionScoreEntered: false,
        })
      }
    }
    if (progress.coreStep === "open_course" && selectedCourse?.collapsed === false) {
      persist({ coreStep: "customize_course" })
    }
    if (
      progress.coreStep === "add_criterion" &&
      selectedCourse?.criteria.length
    ) {
      persist({ coreStep: "configure_criterion" })
    }
    if (progress.coreStep === "dashboard_link" && pathname === "/dashboard") {
      persist({ coreStep: "dashboard_finish" })
    }
  }, [
    activeSemesterId,
    active,
    pathname,
    persist,
    progress.coreSetupRequired,
    progress.coreStep,
    progress.courseId,
    selectedCourse,
    selectedSemester,
    semesters,
  ])

  useEffect(() => {
    if (!active || progress.coreStep !== "configure_criterion") {
      return
    }
    const handleFocusOut = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.dataset.onboardingField === "criterion-score") {
        persist({ criterionScoreEntered: true })
      }
    }
    document.addEventListener("focusout", handleFocusOut, true)
    return () => document.removeEventListener("focusout", handleFocusOut, true)
  }, [active, persist, progress.coreStep])

  useEffect(() => {
    if (!active || serverOffline) return
    const dashboardSteps: CoreOnboardingStep[] = [
      "welcome",
      "add_semester",
      "dashboard_finish",
    ]
    if (dashboardSteps.includes(progress.coreStep) && pathname !== "/dashboard") {
      router.push("/dashboard")
    } else if (
      !dashboardSteps.includes(progress.coreStep) &&
      progress.coreStep !== "dashboard_link" &&
      progress.semesterId &&
      pathname !== `/semesters/${progress.semesterId}`
    ) {
      router.push(`/semesters/${progress.semesterId}`)
    }
  }, [
    active,
    pathname,
    progress.coreStep,
    progress.semesterId,
    router,
    serverOffline,
  ])

  const advanceCore = () => {
    const step = progress.coreStep
    if (step === "welcome") {
      if (!progress.coreSetupRequired && selectedSemester) {
        persist({
          coreStep: "rename_semester",
          semesterId: selectedSemester.id,
          initialSemesterName: selectedSemester.name,
        })
      } else {
        persist({ coreStep: "add_semester" })
      }
      return
    }
    if (step === "add_semester" && !progress.coreSetupRequired) {
      const semester = selectedSemester
      if (!semester) return
      persist({
        coreStep: "rename_semester",
        semesterId: semester.id,
        initialSemesterName: semester.name,
      })
      return
    }
    if (step === "rename_semester") {
      persist({ coreStep: "add_course" })
      return
    }
    if (step === "add_course" && !progress.coreSetupRequired && selectedCourse) {
      persist({
        coreStep: "open_course",
        courseId: selectedCourse.id,
        initialCourseName: selectedCourse.name,
      })
      return
    }
    if (step === "customize_course") {
      persist({ coreStep: "add_criterion" })
      return
    }
    if (step === "configure_criterion") {
      persist({ coreStep: "grade_result" })
      return
    }
    if (step === "grade_result") {
      persist({ coreStep: "navigation" })
      return
    }
    if (step === "navigation") {
      persist({ coreStep: "dashboard_link" })
      return
    }
    if (step === "dashboard_finish") {
      persist({ coreStatus: "completed" })
      setActive(false)
    }
  }

  const skipTour = () => {
    if (!active && !showResume) return
    persist({ coreStatus: "dismissed" })
    setConfirmSkip(false)
    setShowResume(false)
    setActive(false)
  }

  const pauseTour = () => {
    setActive(false)
    setConfirmSkip(false)
  }

  const resume = () => {
    if (!showResume) return
    setActive(true)
    setShowResume(false)
  }

  const startOver = () => startCore(semesters.length > 0)

  if (!active && !showResume) return null

  const presentation = getCorePresentation(
    progress.coreStep,
    progress,
    mobile,
    sidebarOpen,
  )
  const stepIndex = CORE_ORDER.indexOf(progress.coreStep)
  const firstCriterion = selectedCourse?.criteria[0]
  const renamedSemester = Boolean(
    selectedSemester &&
      selectedSemester.name.trim() &&
      selectedSemester.name !== progress.initialSemesterName,
  )
  const renamedCourse = Boolean(
    selectedCourse &&
      selectedCourse.name.trim() &&
      selectedCourse.name !== progress.initialCourseName,
  )
  const configuredCriterion = isFirstCriterionConfigured(
    firstCriterion,
    progress.criterionScoreEntered,
  )
  const canContinueCore =
    !progress.coreSetupRequired ||
    progress.coreStep === "welcome" ||
    (progress.coreStep === "rename_semester" && renamedSemester) ||
    (progress.coreStep === "customize_course" && renamedCourse) ||
    (progress.coreStep === "configure_criterion" && configuredCriterion) ||
    ["grade_result", "navigation", "dashboard_finish"].includes(progress.coreStep)
  const showCoreButton =
    active &&
    !["open_course", "dashboard_link"].includes(progress.coreStep) &&
    (progress.coreSetupRequired
      ? !["add_semester", "add_course", "add_criterion"].includes(progress.coreStep)
      : true)

  const card = showResume && !active ? (
    <div className="relative rounded-xl border border-primary/25 bg-[#fff8f1] p-5 text-foreground shadow-2xl">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/65">
        Onboarding paused
      </p>
      <h2 className="mt-2 text-xl font-bold">Pick up where you left off</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Your progress is saved. Resume the current step or restart the tour without changing your grade data.
      </p>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" onClick={startOver} className="gap-1.5 bg-white">
          <RotateCcw className="h-3.5 w-3.5" /> Start over
        </Button>
        <Button size="sm" onClick={resume} className="gap-1.5">
          Resume <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  ) : presentation ? (
    <div
      role="dialog"
      aria-label={presentation.title}
      className="relative rounded-xl border border-primary/25 bg-[#fff8f1] p-5 text-foreground shadow-2xl"
    >
      <button
        type="button"
        onClick={pauseTour}
        aria-label="Pause onboarding"
        title="Pause and resume later"
        className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
      >
        <Pause className="h-3.5 w-3.5" />
      </button>
      <div className="pr-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/65">
          Getting started · {Math.max(1, stepIndex + 1)} of {CORE_ORDER.length}
        </p>
        <h2 className="mt-2 text-xl font-bold">{presentation.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {presentation.body}
        </p>
      </div>
      <div className="mt-4 flex gap-1" aria-hidden="true">
        {CORE_ORDER.map((step, index) => (
          <span
            key={step}
            className={`h-1 flex-1 rounded-full ${index <= stepIndex ? "bg-primary" : "bg-primary/15"}`}
          />
        ))}
      </div>
      <div className="mt-4 flex min-h-8 items-center justify-between gap-3">
        <p className="text-xs font-medium text-primary/70">
          {serverOffline ? "Reconnect to continue" : presentation.hint ?? ""}
        </p>
        {showCoreButton && (
          <Button
            size="sm"
            disabled={!canContinueCore || serverOffline}
            onClick={advanceCore}
            className="shrink-0 gap-1.5"
          >
            {progress.coreStep === "dashboard_finish" ? "Finish" : "Next"}
            {progress.coreStep === "dashboard_finish" ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
      </div>
    </div>
  ) : null

  return createPortal(
    <AnimatePresence>
      <SpotlightLayer selector={presentation?.selector ?? null}>{card}</SpotlightLayer>
      <button
        type="button"
        onClick={() => setConfirmSkip(true)}
        className="fixed left-1/2 top-3 z-[120] -translate-x-1/2 rounded-full border border-primary/25 bg-[#fff8f1]/95 px-3 py-1.5 text-xs font-semibold text-primary shadow-lg backdrop-blur transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        Skip onboarding
      </button>
      {confirmSkip && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-[#2d0008]/25 px-4 backdrop-blur-[1px]">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-sm rounded-xl border border-primary/25 bg-[#fff8f1] p-5 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setConfirmSkip(false)}
              aria-label="Keep onboarding"
              className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"
            >
              <X className="h-4 w-4" />
            </button>
            <h2 className="pr-8 text-lg font-bold text-foreground">Skip onboarding?</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              It will stop appearing automatically. You can replay it anytime from Settings.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmSkip(false)} className="bg-white">
                Keep going
              </Button>
              <Button size="sm" onClick={skipTour}>Skip</Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
