"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  RotateCcw,
  X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { OnboardingSettingsWizard } from "@/components/onboarding-settings-wizard";
import type { AppSettings } from "@/lib/app-settings";
import type { Semester } from "@/lib/types";
import {
  DEFAULT_ONBOARDING_PROGRESS,
  UI_ONBOARDING_STEPS,
  getNextSettingsOnboardingStep,
  getNextUiOnboardingStep,
  getPreviousSettingsOnboardingStep,
  getPreviousUiOnboardingStep,
  isAutomaticOnboardingEligible,
  isFirstCriterionConfigured,
  isSettingsOnboardingStep,
  isUiOnboardingStep,
  type OnboardingProgress,
  type UiOnboardingStep,
} from "@/lib/onboarding";

interface OnboardingTourProps {
  progress: OnboardingProgress;
  onProgressChange: (progress: OnboardingProgress) => void;
  settings: AppSettings;
  onSettingsUpdate: (updates: Partial<AppSettings>) => Promise<void>;
  launchNonce: number | null;
  authenticated: boolean;
  settingsLoaded: boolean;
  dataLoaded: boolean;
  serverOffline: boolean;
  semesters: Semester[];
  activeSemesterId: string | null;
  sidebarOpen: boolean;
}

interface StepPresentation {
  title: string;
  body: string;
  selector: string | null;
  hint?: string;
}

const paperCardClass =
  "relative overflow-visible rounded-md border-2 border-primary/30 bg-[#fff8f1] text-foreground shadow-[0_14px_35px_rgba(45,0,8,0.22)]";

function PaperAccents({ centered = false }: { centered?: boolean }) {
  return (
    <>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -top-2.5 h-5 w-20 border border-white/25 bg-primary/20 ${
          centered
            ? "left-1/2 -translate-x-1/2 rotate-[1deg]"
            : "left-7 rotate-[-2deg]"
        }`}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 h-8 w-8 bg-primary/8 [clip-path:polygon(100%_0,0_100%,100%_100%)]"
      />
    </>
  );
}

const selectorForCourse = (courseId: string | undefined, target?: string) => {
  if (!courseId) return null;
  const safeId = courseId.replace(/["\\]/g, "");
  const base = `[data-onboarding-course-id="${safeId}"]`;
  return target ? `${base} [data-onboarding-target="${target}"]` : base;
};

function getCorePresentation(
  step: UiOnboardingStep,
  progress: OnboardingProgress,
  mobile: boolean,
  sidebarOpen: boolean,
): StepPresentation {
  switch (step) {
    case "welcome":
      return {
        title: "Welcome to CourseGrade",
        body: "Let’s build your first semester, course, and weighted grade together.",
        selector: null,
      };
    case "add_semester":
      return {
        title: "Start with a semester",
        body: progress.coreSetupRequired
          ? "Create the semester you want to track first."
          : "This is where a new term begins. You can continue with an existing semester for this replay.",
        selector: '[data-onboarding-target="add-semester-main"]',
        hint: progress.coreSetupRequired
          ? "Select Add Semester to continue"
          : undefined,
      };
    case "rename_semester":
      return {
        title: "Make it yours",
        body: "Select the semester title and give it a useful name, such as Fall 2026.",
        selector: '[data-onboarding-target="semester-title"]',
        hint: progress.coreSetupRequired
          ? "Rename the semester to continue"
          : undefined,
      };
    case "add_course":
      return {
        title: "Add your first course",
        body: "Courses live inside semesters and roll up into your semester and overall GPA.",
        selector: '[data-onboarding-target="add-course"]',
        hint: "Select Add Course to continue",
      };
    case "open_course":
      return {
        title: "Open the course card",
        body: "Course cards stay compact until you need them. Open this one to set up its details.",
        selector: selectorForCourse(progress.courseId),
        hint: "Select the card to continue",
      };
    case "customize_course":
      return {
        title: "Name your course",
        body: "Replace the generated name and check the credit value.",
        selector: selectorForCourse(progress.courseId, "course-basics"),
        hint: progress.coreSetupRequired
          ? "Rename the course to continue"
          : undefined,
      };
    case "add_criterion":
      return {
        title: "Build the grade breakdown",
        body: "Add a weighted category such as Assignments or Exams. For a quick overall grade, use the grade pencil before adding criteria.",
        selector: selectorForCourse(progress.courseId, "add-criterion"),
        hint: "Select Add Criteria to continue",
      };
    case "configure_criterion":
      return {
        title: "Set up the first category",
        body: "Give it a name, a positive weight, and its current score. CourseGrade recalculates as soon as each value is committed.",
        selector: selectorForCourse(progress.courseId, "criterion-row"),
        hint: "Complete name, weight, and score to continue",
      };
    case "grade_result":
      return {
        title: "Your grade stays current",
        body: "The numeric and letter grade update automatically. The weight indicator warns you until all categories total 100%.",
        selector: selectorForCourse(progress.courseId, "grade-result"),
      };
    case "navigation":
      return {
        title:
          mobile && !sidebarOpen
            ? "Open your overview"
            : "Everything stays within reach",
        body: mobile
          ? sidebarOpen
            ? "Use this overview to move between semesters and courses, rename items, and manage your account."
            : "On smaller screens, Overview opens your semester and course navigation."
          : "The sidebar moves between semesters and courses and gives you quick editing and access controls.",
        selector:
          mobile && !sidebarOpen
            ? '[data-onboarding-target="overview-trigger"]'
            : mobile
              ? '[data-onboarding-target="sidebar-overlay"]'
              : '[data-onboarding-target="sidebar-desktop"]',
        hint: mobile && !sidebarOpen ? "Open Overview to continue" : undefined,
      };
    case "dashboard_link":
      return {
        title: "Return to the big picture",
        body: "Go back to the dashboard for a quick overview!",
        selector: '[data-onboarding-target="dashboard-link"]',
        hint: "Select Dashboard to continue",
      };
    case "dashboard_finish":
      return {
        title: "You’re ready",
        body: "Your GPA, credits, trends, and semesters now stay organized here as your courses change.",
        selector: '[data-onboarding-target="dashboard-overview"]',
      };
  }
}

function SpotlightLayer({
  selector,
  children,
}: {
  selector: string | null;
  children: React.ReactNode;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const scrolledSelectorRef = useRef<string | null>(null);

  useEffect(() => {
    let frame = 0;
    let resizeObserver: ResizeObserver | null = null;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setViewport({ width: window.innerWidth, height: window.innerHeight });
        const target = selector
          ? document.querySelector<HTMLElement>(selector)
          : null;
        setRect(target?.getBoundingClientRect() ?? null);
        resizeObserver?.disconnect();
        if (target) {
          resizeObserver = new ResizeObserver(update);
          resizeObserver.observe(target);
          if (scrolledSelectorRef.current !== selector) {
            scrolledSelectorRef.current = selector;
            target.scrollIntoView({
              behavior: "auto",
              block: "center",
              inline: "nearest",
            });
          }
        }
      });
    };
    update();
    const mutationObserver = new MutationObserver(update);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(frame);
      mutationObserver.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [selector]);

  const pad = 8;
  const hole = rect
    ? {
        left: Math.max(0, rect.left - pad),
        top: Math.max(0, rect.top - pad),
        right: Math.min(viewport.width, rect.right + pad),
        bottom: Math.min(viewport.height, rect.bottom + pad),
      }
    : null;
  const dimClass = "fixed z-[90] bg-[#2d0008]/25";
  const tooltipStyle = (() => {
    if (!hole || viewport.width < 640) return undefined;
    const width = Math.min(340, viewport.width - 32);
    const left = Math.min(
      viewport.width - width - 16,
      Math.max(16, hole.left + (hole.right - hole.left - width) / 2),
    );
    const estimatedHeight = 270;
    const below = hole.bottom + 14;
    const top =
      below + estimatedHeight <= viewport.height
        ? below
        : Math.max(16, hole.top - estimatedHeight - 14);
    return { left, top, width };
  })();

  return (
    <>
      {hole ? (
        <>
          <div
            className={`${dimClass} inset-x-0 top-0`}
            style={{ height: hole.top }}
          />
          <div
            className={dimClass}
            style={{
              left: 0,
              top: hole.top,
              width: hole.left,
              height: hole.bottom - hole.top,
            }}
          />
          <div
            className={dimClass}
            style={{
              left: hole.right,
              right: 0,
              top: hole.top,
              height: hole.bottom - hole.top,
            }}
          />
          <div
            className={`${dimClass} inset-x-0 bottom-0`}
            style={{ top: hole.bottom }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none fixed z-[92] rounded-xl ring-2 ring-primary/70 ring-offset-4 ring-offset-transparent"
            style={{
              left: hole.left,
              top: hole.top,
              width: hole.right - hole.left,
              height: hole.bottom - hole.top,
            }}
          />
        </>
      ) : (
        <div className="fixed inset-0 z-[90] bg-[#2d0008]/25" />
      )}
      <div
        key={selector ?? "centered"}
        className={
          tooltipStyle
            ? "fixed z-[100]"
            : "fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-sm sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[360px] sm:-translate-x-1/2 sm:-translate-y-1/2"
        }
        style={tooltipStyle}
      >
        {children}
      </div>
    </>
  );
}

export function OnboardingTour({
  progress,
  onProgressChange,
  settings,
  onSettingsUpdate,
  launchNonce,
  authenticated,
  settingsLoaded,
  dataLoaded,
  serverOffline,
  semesters,
  activeSemesterId,
  sidebarOpen,
}: OnboardingTourProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [showResume, setShowResume] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [reviewStep, setReviewStep] = useState<UiOnboardingStep | null>(null);
  const initialEvaluationRef = useRef(false);
  const launchNonceRef = useRef<number | null>(null);

  const persist = useCallback(
    (updates: Partial<OnboardingProgress>) => {
      onProgressChange({ ...progress, ...updates });
    },
    [onProgressChange, progress],
  );

  const selectedSemester = useMemo(
    () =>
      semesters.find((semester) => semester.id === progress.semesterId) ??
      semesters.find((semester) => semester.id === activeSemesterId) ??
      semesters[0],
    [activeSemesterId, progress.semesterId, semesters],
  );
  const selectedCourse = useMemo(
    () =>
      selectedSemester?.courses.find(
        (course) => course.id === progress.courseId,
      ) ?? selectedSemester?.courses[0],
    [progress.courseId, selectedSemester],
  );
  const currentUiStep = isUiOnboardingStep(progress.coreStep)
    ? progress.coreStep
    : "welcome";
  const displayedUiStep = reviewStep ?? currentUiStep;

  useEffect(() => {
    setReviewStep(null);
  }, [progress.coreStep]);

  useEffect(() => {
    const update = () => setMobile(window.innerWidth < 768);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const startCore = useCallback(
    (replay: boolean) => {
      const semester = replay ? semesters[0] : undefined;
      const course = semester?.courses[0];
      onProgressChange({
        ...DEFAULT_ONBOARDING_PROGRESS,
        coreStatus: "in_progress",
        coreSetupRequired: !replay,
        semesterId: semester?.id,
        courseId: course?.id,
        initialSemesterName: semester?.name,
        initialCourseName: course?.name,
      });
      setShowResume(false);
      setReviewStep(null);
      setActive(true);
      router.push("/dashboard");
    },
    [onProgressChange, router, semesters],
  );

  useEffect(() => {
    if (launchNonce === null || launchNonceRef.current === launchNonce) return;
    launchNonceRef.current = launchNonce;
    if (progress.coreStatus === "in_progress") {
      setShowResume(false);
      setActive(true);
    } else {
      startCore(semesters.length > 0);
    }
  }, [launchNonce, progress.coreStatus, semesters.length, startCore]);

  useEffect(() => {
    if (
      !dataLoaded ||
      progress.coreStatus !== "in_progress" ||
      isSettingsOnboardingStep(progress.coreStep)
    ) {
      return;
    }
    const storedSemester = semesters.find(
      (semester) => semester.id === progress.semesterId,
    );
    if (progress.semesterId && !storedSemester) {
      const fallbackSemester = semesters[0];
      persist(
        fallbackSemester
          ? {
              coreStep:
                fallbackSemester.courses.length > 0
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
      );
      return;
    }

    if (
      storedSemester &&
      progress.courseId &&
      !storedSemester.courses.some((course) => course.id === progress.courseId)
    ) {
      const fallbackCourse = storedSemester.courses[0];
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
      );
    }
  }, [dataLoaded, persist, progress, semesters]);

  useEffect(() => {
    if (
      initialEvaluationRef.current ||
      !authenticated ||
      !settingsLoaded ||
      !dataLoaded ||
      serverOffline
    ) {
      return;
    }
    initialEvaluationRef.current = true;
    if (progress.coreStatus === "in_progress") {
      if (isSettingsOnboardingStep(progress.coreStep)) {
        setActive(true);
      } else {
        setShowResume(true);
      }
      return;
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
      startCore(false);
    }
  }, [
    authenticated,
    dataLoaded,
    progress,
    semesters.length,
    serverOffline,
    settingsLoaded,
    startCore,
  ]);

  useEffect(() => {
    if (!active) return;
    if (progress.coreStep === "add_semester" && progress.coreSetupRequired) {
      const semester =
        semesters.find((item) => item.id === activeSemesterId) ??
        semesters.at(-1);
      if (semester) {
        persist({
          coreStep: "rename_semester",
          semesterId: semester.id,
          initialSemesterName: semester.name,
        });
      }
    }
    if (progress.coreStep === "add_course") {
      const semester = selectedSemester;
      const course = semester?.courses.at(-1);
      if (course && course.id !== progress.courseId) {
        persist({
          coreStep: "open_course",
          courseId: course.id,
          initialCourseName: course.name,
          criterionScoreEntered: false,
        });
      }
    }
    if (
      progress.coreStep === "open_course" &&
      selectedCourse?.collapsed === false
    ) {
      persist({ coreStep: "customize_course" });
    }
    if (
      progress.coreStep === "add_criterion" &&
      selectedCourse?.criteria.length
    ) {
      persist({ coreStep: "configure_criterion" });
    }
    if (progress.coreStep === "dashboard_link" && pathname === "/dashboard") {
      persist({ coreStep: "dashboard_finish" });
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
  ]);

  useEffect(() => {
    if (!active || progress.coreStep !== "configure_criterion") {
      return;
    }
    const handleFocusOut = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.dataset.onboardingField === "criterion-score") {
        persist({ criterionScoreEntered: true });
      }
    };
    document.addEventListener("focusout", handleFocusOut, true);
    return () => document.removeEventListener("focusout", handleFocusOut, true);
  }, [active, persist, progress.coreStep]);

  useEffect(() => {
    if (!active || serverOffline) return;
    if (isSettingsOnboardingStep(progress.coreStep)) return;
    const dashboardSteps: UiOnboardingStep[] = [
      "welcome",
      "add_semester",
      "dashboard_finish",
    ];
    if (dashboardSteps.includes(displayedUiStep) && pathname !== "/dashboard") {
      router.push("/dashboard");
    } else if (
      !dashboardSteps.includes(displayedUiStep) &&
      (displayedUiStep !== "dashboard_link" || reviewStep !== null) &&
      progress.semesterId &&
      pathname !== `/semesters/${progress.semesterId}`
    ) {
      router.push(`/semesters/${progress.semesterId}`);
    }
  }, [
    active,
    displayedUiStep,
    pathname,
    progress.semesterId,
    reviewStep,
    router,
    serverOffline,
  ]);

  const advanceCore = () => {
    const step = progress.coreStep;
    if (step === "welcome") {
      persist({ coreStep: "add_semester" });
      return;
    }
    if (step === "add_semester" && !progress.coreSetupRequired) {
      const semester =
        semesters.find((item) => item.id === activeSemesterId) ??
        selectedSemester;
      if (!semester) return;
      persist({
        coreStep: "rename_semester",
        semesterId: semester.id,
        initialSemesterName: semester.name,
      });
      return;
    }
    if (step === "rename_semester") {
      persist({ coreStep: "add_course" });
      return;
    }
    if (
      step === "add_course" &&
      !progress.coreSetupRequired &&
      selectedCourse
    ) {
      persist({
        coreStep: "open_course",
        courseId: selectedCourse.id,
        initialCourseName: selectedCourse.name,
      });
      return;
    }
    if (step === "customize_course") {
      persist({ coreStep: "add_criterion" });
      return;
    }
    if (step === "configure_criterion") {
      persist({ coreStep: "grade_result" });
      return;
    }
    if (step === "grade_result") {
      persist({ coreStep: "navigation" });
      return;
    }
    if (step === "navigation") {
      persist({ coreStep: "dashboard_link" });
      return;
    }
    if (step === "dashboard_finish") {
      persist({ coreStatus: "completed" });
      setActive(false);
    }
  };

  const beginUiTour = () => {
    setReviewStep(null);
    persist({ coreStep: "welcome" });
    router.push("/dashboard");
  };

  const goBackCore = () => {
    const previousStep = getPreviousUiOnboardingStep(
      displayedUiStep,
    );
    if (previousStep) setReviewStep(previousStep);
  };

  const advanceReview = () => {
    if (!reviewStep) return;
    const nextStep = getNextUiOnboardingStep(
      reviewStep,
    );
    if (!nextStep || nextStep === currentUiStep) {
      setReviewStep(null);
      return;
    }
    setReviewStep(nextStep);
  };

  const advanceSettings = () => {
    if (!isSettingsOnboardingStep(progress.coreStep)) return;
    const nextStep = getNextSettingsOnboardingStep(progress.coreStep);
    if (nextStep) {
      persist({ coreStep: nextStep });
      return;
    }
    beginUiTour();
  };

  const goBackInSettings = () => {
    if (!isSettingsOnboardingStep(progress.coreStep)) return;
    const previousStep = getPreviousSettingsOnboardingStep(progress.coreStep);
    if (previousStep) persist({ coreStep: previousStep });
  };

  const skipTour = () => {
    if (!active && !showResume) return;
    persist({ coreStatus: "dismissed" });
    setConfirmSkip(false);
    setShowResume(false);
    setActive(false);
  };

  const resume = () => {
    if (!showResume) return;
    setActive(true);
    setShowResume(false);
  };

  const startOver = () => startCore(semesters.length > 0);

  if (!active && !showResume) return null;

  if (active && isSettingsOnboardingStep(progress.coreStep)) {
    return createPortal(
      <OnboardingSettingsWizard
        step={progress.coreStep}
        settings={settings}
        onSettingsUpdate={onSettingsUpdate}
        onBack={goBackInSettings}
        onNext={advanceSettings}
        onSkip={beginUiTour}
      />,
      document.body,
    );
  }

  const presentation = getCorePresentation(
    displayedUiStep,
    progress,
    mobile,
    sidebarOpen,
  );
  const stepIndex = UI_ONBOARDING_STEPS.indexOf(displayedUiStep);
  const firstCriterion = selectedCourse?.criteria[0];
  const renamedSemester = Boolean(
    selectedSemester &&
    selectedSemester.name.trim() &&
    selectedSemester.name !== progress.initialSemesterName,
  );
  const renamedCourse = Boolean(
    selectedCourse &&
    selectedCourse.name.trim() &&
    selectedCourse.name !== progress.initialCourseName,
  );
  const configuredCriterion = isFirstCriterionConfigured(
    firstCriterion,
    progress.criterionScoreEntered,
  );
  const canContinueCore =
    !progress.coreSetupRequired ||
    displayedUiStep === "welcome" ||
    (displayedUiStep === "rename_semester" && renamedSemester) ||
    (displayedUiStep === "customize_course" && renamedCourse) ||
    (displayedUiStep === "configure_criterion" && configuredCriterion) ||
    ["grade_result", "navigation", "dashboard_finish"].includes(
      displayedUiStep,
    );
  const showCoreButton =
    Boolean(reviewStep) ||
    (active &&
      !["open_course", "dashboard_link"].includes(displayedUiStep) &&
      (progress.coreSetupRequired
        ? !["add_semester", "add_course", "add_criterion"].includes(
            displayedUiStep,
          )
        : true));
  const previousUiStep = getPreviousUiOnboardingStep(
    displayedUiStep,
  );

  const card =
    showResume && !active ? (
      <div
        className={`${paperCardClass} rotate-[0.35deg] p-5 pt-7 motion-reduce:rotate-0`}
      >
        <PaperAccents />
        <p className="font-futura-bold text-[10px] font-black uppercase tracking-[0.22em] text-primary/70">
          Saved for later
        </p>
        <h2 className="mt-2 font-futura-bold text-xl font-black uppercase tracking-wide">
          Pick up where you left off
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Your progress is saved. Resume the current step or restart the tour
          without changing your grade data.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed border-primary/20 pt-4">
          <button
            type="button"
            onClick={() => setConfirmSkip(true)}
            className="rounded-sm text-xs font-semibold text-muted-foreground underline decoration-primary/35 underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            Skip tour
          </button>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={startOver}
              className="gap-1.5 bg-white transition-none"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Start over
            </Button>
            <Button
              size="sm"
              onClick={resume}
              className="gap-1.5 transition-none"
            >
              Resume <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    ) : presentation ? (
      <div
        role="dialog"
        aria-label={presentation.title}
        className={`${paperCardClass} rotate-[-0.35deg] p-5 pt-7 motion-reduce:rotate-0`}
      >
        <PaperAccents />
        <div>
          <p className="font-futura-bold text-[10px] font-black uppercase tracking-[0.22em] text-primary/70">
            Page {Math.max(1, stepIndex + 1)} of {UI_ONBOARDING_STEPS.length}
          </p>
          <h2 className="mt-2 font-futura-bold text-xl font-black uppercase tracking-wide">
            {presentation.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {presentation.body}
          </p>
        </div>
        <div className="mt-5 border-t-2 border-dashed border-primary/20 pt-4">
          <p className="min-h-4 text-xs font-semibold text-primary/70">
            {serverOffline
              ? "Reconnect to continue"
              : reviewStep
                ? "Reviewing a completed step"
                : (presentation.hint ?? "")}
          </p>
          <div className="mt-2 flex min-h-8 items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setConfirmSkip(true)}
              className="rounded-sm text-xs font-semibold text-muted-foreground underline decoration-primary/35 underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              Skip tour
            </button>
            <div className="flex items-center justify-end gap-2">
              {previousUiStep && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={serverOffline}
                  onClick={goBackCore}
                  className="shrink-0 gap-1.5 bg-white transition-none"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </Button>
              )}
              {showCoreButton && (
                <Button
                  size="sm"
                  disabled={(!reviewStep && !canContinueCore) || serverOffline}
                  onClick={reviewStep ? advanceReview : advanceCore}
                  className="shrink-0 gap-1.5 transition-none"
                >
                  {displayedUiStep === "dashboard_finish" ? "Finish" : "Next"}
                  {displayedUiStep === "dashboard_finish" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    ) : null;

  return createPortal(
    <>
      <SpotlightLayer selector={presentation?.selector ?? null}>
        {card}
      </SpotlightLayer>
      {confirmSkip && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-[#2d0008]/30 px-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="skip-onboarding-title"
            aria-describedby="skip-onboarding-description"
            className={`${paperCardClass} w-full max-w-sm rotate-[0.4deg] p-5 pt-7 motion-reduce:rotate-0`}
          >
            <PaperAccents centered />
            <button
              type="button"
              onClick={() => setConfirmSkip(false)}
              aria-label="Keep onboarding"
              className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"
            >
              <X className="h-4 w-4" />
            </button>
            <h2
              id="skip-onboarding-title"
              className="pr-8 font-futura-bold text-lg font-black uppercase tracking-wide text-foreground"
            >
              Skip onboarding?
            </h2>
            <p
              id="skip-onboarding-description"
              className="mt-2 text-sm leading-relaxed text-muted-foreground"
            >
              It will stop appearing automatically. You can replay it anytime
              from Settings.
            </p>
            <div className="mt-5 flex justify-end gap-2 border-t-2 border-dashed border-primary/20 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmSkip(false)}
                className="bg-white transition-none"
              >
                Keep going
              </Button>
              <Button size="sm" onClick={skipTour} className="transition-none">
                Skip tour
              </Button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
