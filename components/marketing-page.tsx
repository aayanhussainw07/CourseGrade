"use client";

import { signIn } from "next-auth/react";
import Image from "next/image";
import {
  Award,
  BarChart3,
  BookOpen,
  Calculator,
  GraduationCap,
  Layers,
  NotebookPen,
  Pencil,
  Plus,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CourseCard } from "@/components/course-card";
import { DashboardPanel } from "@/components/dashboard-panel";
import { useInView } from "@/hooks/use-in-view";
import {
  marketingCourses,
  marketingCourseCard,
  marketingDashboardStats,
  marketingFeatures,
  marketingTimelineData,
} from "@/app/page-marketing-data";

const GoogleIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4 fill-white shrink-0"
    aria-hidden="true"
  >
    <path d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z" />
  </svg>
);

const Tape = ({ className = "" }: { className?: string }) => (
  <span
    aria-hidden="true"
    className={`pointer-events-none absolute h-5 w-24 bg-primary/20 ${className}`}
  />
);

// Scattered hand-drawn-style icons that sit behind the feature grid.
// Cards have solid backgrounds, so doodles only peek through whitespace.
const DOODLES: {
  Icon: typeof Star;
  top: string;
  left: string;
  size: number;
  rotate: number;
  hideSm?: boolean;
}[] = [
  { Icon: GraduationCap, top: "6%", left: "4%", size: 44, rotate: -12 },
  { Icon: Plus, top: "10%", left: "44%", size: 22, rotate: 8, hideSm: true },
  { Icon: Star, top: "4%", left: "72%", size: 26, rotate: 14, hideSm: true },
  { Icon: TrendingUp, top: "18%", left: "88%", size: 40, rotate: -8 },
  { Icon: Sparkles, top: "30%", left: "2%", size: 30, rotate: 10 },
  {
    Icon: BookOpen,
    top: "26%",
    left: "60%",
    size: 34,
    rotate: -6,
    hideSm: true,
  },
  {
    Icon: Calculator,
    top: "44%",
    left: "92%",
    size: 30,
    rotate: 12,
    hideSm: true,
  },
  { Icon: Pencil, top: "52%", left: "6%", size: 28, rotate: -18 },
  { Icon: Award, top: "62%", left: "48%", size: 36, rotate: 6, hideSm: true },
  { Icon: BarChart3, top: "70%", left: "90%", size: 38, rotate: -10 },
  { Icon: Layers, top: "82%", left: "10%", size: 30, rotate: 14, hideSm: true },
  { Icon: Star, top: "88%", left: "38%", size: 22, rotate: -12, hideSm: true },
  { Icon: NotebookPen, top: "84%", left: "70%", size: 34, rotate: 8 },
  { Icon: Plus, top: "58%", left: "30%", size: 20, rotate: -8, hideSm: true },
  { Icon: Star, top: "16%", left: "20%", size: 18, rotate: 20, hideSm: true },
  {
    Icon: Sparkles,
    top: "48%",
    left: "70%",
    size: 24,
    rotate: -14,
    hideSm: true,
  },
  {
    Icon: GraduationCap,
    top: "74%",
    left: "56%",
    size: 30,
    rotate: 10,
    hideSm: true,
  },
  {
    Icon: TrendingUp,
    top: "38%",
    left: "36%",
    size: 26,
    rotate: 6,
    hideSm: true,
  },
  { Icon: BookOpen, top: "92%", left: "88%", size: 28, rotate: -8 },
  { Icon: Pencil, top: "12%", left: "62%", size: 22, rotate: 16, hideSm: true },
  { Icon: Award, top: "22%", left: "30%", size: 24, rotate: -10, hideSm: true },
  { Icon: Plus, top: "78%", left: "26%", size: 18, rotate: 12, hideSm: true },
];

const DoodleField = () => (
  <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
  >
    {DOODLES.map((d, i) => {
      const Icon = d.Icon;
      return (
        <Icon
          key={i}
          className={`absolute text-primary/20 ${d.hideSm ? "hidden md:block" : ""}`}
          strokeWidth={2.25}
          style={{
            top: d.top,
            left: d.left,
            width: d.size,
            height: d.size,
            transform: `rotate(${d.rotate}deg)`,
          }}
        />
      );
    })}
  </div>
);

const BlockHeading = ({
  children,
  className = "",
  border = true,
}: {
  children: React.ReactNode;
  className?: string;
  border?: boolean;
}) => (
  <span
    className={`relative inline-flex items-center justify-center rounded-sm bg-[#fff8f1] px-6 py-2 font-futura-bold font-black uppercase tracking-widest text-foreground ${border ? "border-2 border-primary/30" : ""} ${className}`}
  >
    <Tape className="-top-3 left-1/2 -translate-x-1/2 rotate-[-2deg]" />
    {children}
  </span>
);

const revealClass = (
  isHydrated: boolean,
  inView: boolean,
  animationClass: string,
) => {
  if (!isHydrated) return "";
  return inView ? animationClass : "opacity-0";
};

const marketingOverallGpa =
  marketingDashboardStats.find((stat) => stat.label === "Overall GPA")?.value ??
  "3.91";
const marketingSemesters =
  marketingDashboardStats.find((stat) => stat.label === "Semesters Tracked")
    ?.value ?? "6";
const marketingCredits =
  marketingDashboardStats.find((stat) => stat.label === "Total Credits")
    ?.value ?? "0";

function MarketingDashboardMock() {
  return (
    <div
      role="img"
      aria-label={`Example dashboard showing a ${marketingOverallGpa} overall GPA, ${marketingSemesters} semesters tracked, and ${marketingCredits} total credits`}
      className="relative overflow-hidden rounded-xl bg-[#2d0008] p-4 sm:p-6 lg:p-8"
      style={{
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 40px)",
      }}
    >
      <div className="grid gap-4 md:gap-6 lg:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.65fr)]">
        <div className="relative min-h-[190px] rotate-[-1deg] rounded-md border border-[#e0c678] bg-[#fff0a8] p-5 text-foreground sm:p-6">
          <div className="absolute -top-3 left-1/2 h-7 w-28 -translate-x-1/2 rotate-2 border border-white/35 bg-white/45" />
          <p className="font-etna text-3xl leading-none text-primary">
            QUOTE IT!
          </p>
          <p className="mt-8 text-xl italic leading-relaxed text-foreground/85">
            “WOOOOOHOOOOO!”
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 sm:grid-rows-2 md:gap-6">
          <div className="relative flex min-h-[190px] rotate-[0.8deg] flex-col rounded-md border-2 border-primary/35 bg-[#fff8f1] p-5 text-foreground sm:col-span-2 sm:row-span-2 sm:p-6">
            <div className="absolute -top-2.5 left-7 h-6 w-24 rotate-[-3deg] bg-primary/25" />
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Overall GPA
            </p>
            <p className="mt-auto text-6xl font-black leading-none text-primary sm:text-8xl">
              {marketingOverallGpa}
            </p>
          </div>

          {[
            {
              label: "Semesters",
              value: marketingSemesters,
              detail: "tracked",
              rotate: "rotate-[0.6deg]",
            },
            {
              label: "Total Credits",
              value: marketingCredits,
              detail: "credits",
              rotate: "rotate-[-0.9deg]",
            },
          ].map(({ label, value, detail, rotate }) => (
            <div
              key={label}
              className={`relative flex min-h-[82px] flex-col justify-center rounded-md border border-primary/20 bg-[#fff8f1] p-5 text-foreground ${rotate}`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {label}
              </p>
              <div className="mt-1.5 flex items-baseline gap-2">
                <p className="text-3xl font-bold leading-none text-primary">
                  {value}
                </p>
                <span className="text-xs font-semibold uppercase text-foreground/45">
                  {detail}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MarketingCourseMock() {
  return (
    <div className="mt-14 grid gap-8 lg:grid-cols-[minmax(240px,0.65fr)_minmax(0,1.35fr)] lg:items-center lg:gap-12">
      <div className="max-w-xl">
        <h3 className="mt-3 font-futura-bold text-3xl font-black uppercase leading-none tracking-widest text-foreground sm:text-4xl">
          Know exactly where you stand
        </h3>
        <p className="mt-5 text-base leading-7 text-muted-foreground sm:text-lg">
          Courses have full customization: grading curves, weights, extra
          credit, and bonuses!
        </p>
      </div>

      <div
        role="img"
        aria-label="Example Data Structures course card with weighted grade categories and a 92.30 percent A-minus grade"
        className="relative rotate-[0.4deg]"
      >
        <div inert aria-hidden="true">
          <CourseCard
            course={marketingCourseCard}
            onUpdate={() => undefined}
            onDelete={() => undefined}
            skipDeleteConfirm
          />
        </div>
      </div>
    </div>
  );
}

export function MarketingPage() {
  const {
    ref: featuresRef,
    inView: featuresInView,
    isHydrated: featuresHydrated,
  } = useInView(0.3);
  const {
    ref: dashboardRef,
    inView: dashboardInView,
    isHydrated: dashboardHydrated,
  } = useInView(0.2);
  const {
    ref: chartsRef,
    inView: chartsInView,
    isHydrated: chartsHydrated,
  } = useInView(0.2);
  const {
    ref: ctaRef,
    inView: ctaInView,
    isHydrated: ctaHydrated,
  } = useInView(0.3);

  return (
    <div
      className="min-h-screen overflow-x-hidden bg-background text-foreground"
      data-nav-tone="light"
    >
      {/* HERO */}
      <section
        data-nav-tone="dark"
        className="relative bg-foreground text-white overflow-hidden"
      >
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, white 0px, white 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, white 0px, white 1px, transparent 1px, transparent 40px)",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-6 py-20 lg:px-12">
          <div className="flex flex-col items-center text-center max-w-3xl mx-auto gap-10">
            <div className="animate-fade-up w-full space-y-6">
              <div className="relative mx-auto flex w-fit items-center justify-center gap-3 px-5 py-3">
                <div className="animate-logo-wiggle">
                  <Image
                    src="/coursegrade.png"
                    alt="CourseGrade"
                    width={48}
                    height={48}
                    className="h-12 w-12"
                  />
                </div>
                <span className="font-etna text-3xl text-white">
                  coursegrade.
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <BlockHeading
                    border={false}
                    className="text-3xl leading-none sm:text-5xl"
                  >
                    Grades getting loud?
                  </BlockHeading>
                </div>
                <div className="pl-4">
                  <BlockHeading
                    border={false}
                    className="rotate-[0.8deg] text-3xl leading-none sm:text-5xl"
                  >
                    Make the next move.
                  </BlockHeading>
                </div>
              </div>

              <p className="text-lg text-white/70 max-w-lg mx-auto text-center">
                Track those grades before they end up tracking you. <br></br>{" "}
                (or whatever that means)
              </p>

              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <Button
                  size="lg"
                  className="gap-2 rounded-md bg-primary px-8 text-white transition-all hover:-translate-y-0.5 hover:bg-primary/90"
                  onClick={() => void signIn("google")}
                >
                  <GoogleIcon />
                  Start tracking
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Diagonal cut */}
        <div
          data-nav-tone="light"
          className="relative h-14 bg-background"
          style={{ clipPath: "polygon(0 100%, 100% 0, 100% 100%)" }}
        />
      </section>

      {/* FEATURES */}
      <section
        data-nav-tone="light"
        id="feature-grid"
        className="relative -mt-px overflow-hidden bg-background py-20"
      >
        <DoodleField />
        <div className="relative z-10 mx-auto max-w-[1400px] px-2 lg:px-4">
          <div className="mb-10 px-4 text-center md:text-left lg:px-10">
            <h2 className="font-futura-bold text-4xl font-black uppercase leading-none tracking-widest text-foreground sm:text-5xl lg:text-6xl">
              See your progress
              <span className="block text-primary">at a glance</span>
            </h2>
            <div className="mx-auto mt-4 h-1.5 w-24 bg-primary md:mx-0" />
          </div>
          <div
            ref={featuresRef}
            className={`grid gap-6 px-4 md:grid-cols-3 md:grid-rows-2 ${revealClass(featuresHydrated, featuresInView, "animate-fade-up")}`}
          >
            {marketingFeatures.map((feature, i) => {
              const isHero = i === 0;
              const FeatureIcon = feature.icon;
              // Cards ascend left→right to follow the slanted divider:
              // hero sits low + tilts up on its right edge, the two
              // stacked cards lift progressively higher.
              const layout = isHero
                ? "flex flex-col items-center justify-center min-h-72 md:min-h-[24rem] p-6 sm:p-9 md:col-span-2 md:row-span-2 md:mt-6 rotate-[-2deg]"
                : i === 1
                  ? "flex flex-col items-center justify-center md:self-start min-h-44 md:min-h-[17rem] p-6 md:-translate-y-10 rotate-[-2deg]"
                  : "flex flex-col items-center justify-center md:self-start min-h-44 md:min-h-[12rem] p-6 md:-translate-y-7 rotate-[-2deg]";

              return (
                <div
                  data-nav-tone="dark"
                  key={feature.title}
                  className={`${revealClass(featuresHydrated, featuresInView, "animate-fade-up-sm")} group relative rounded-lg text-center text-white transition-all duration-300 hover:-translate-y-2 hover:rotate-0 ${layout}`}
                  style={{
                    animationDelay: featuresInView ? `${i * 0.1}s` : undefined,
                    backgroundColor:
                      ["#a8473d", "#c56b5e", "#8f3a32"][i] ?? "#b5564b",
                  }}
                >
                  <div className="mb-5 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                    <FeatureIcon className="h-7 w-7 text-white/85" />
                  </div>
                  <Tape
                    className={
                      isHero
                        ? "-top-3 left-12 rotate-[-3deg] bg-white/25"
                        : "-top-3 right-10 rotate-[2deg] bg-white/25"
                    }
                  />
                  <h3
                    className={`mb-3 font-futura-bold font-black uppercase tracking-wide text-white ${
                      isHero ? "text-4xl sm:text-6xl" : "text-2xl sm:text-3xl"
                    }`}
                  >
                    {feature.title}
                  </h3>
                  <p
                    className={`text-white/80 ${
                      isHero
                        ? "max-w-2xl text-lg sm:text-2xl sm:leading-9"
                        : "text-base sm:text-lg sm:leading-8"
                    }`}
                  >
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* DASHBOARD MOCK */}
      <section
        data-nav-tone="light"
        className="relative overflow-hidden bg-background pb-20"
      >
        <DoodleField />
        <div className="relative z-10 mx-auto max-w-[1400px] px-6 lg:px-14">
          <div
            ref={dashboardRef}
            className={revealClass(
              dashboardHydrated,
              dashboardInView,
              "animate-fade-up",
            )}
          >
            <div className="mb-8 grid gap-4 lg:grid-cols-[minmax(0,0.6fr)_minmax(0,1.2fr)] lg:items-end">
              <div>
                <h2 className="font-futura-bold text-3xl font-black uppercase leading-none tracking-widest text-foreground sm:text-4xl">
                  Track the whole picture
                </h2>
              </div>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Our dashboard shows you an overview of all your semesters.
              </p>
            </div>
            <MarketingDashboardMock />
            <MarketingCourseMock />
          </div>
        </div>
      </section>

      {/* CHARTS */}
      <section
        data-nav-tone="light"
        className="relative overflow-hidden bg-background pb-16"
      >
        <DoodleField />
        <div className="relative z-10 mx-auto max-w-[1400px] px-2 lg:px-4">
          <div
            className={`mx-4 mb-6 flex justify-start lg:mx-10 ${revealClass(chartsHydrated, chartsInView, "animate-fade-up")}`}
          >
            <div>
              <h2 className="font-futura-bold text-4xl font-black uppercase leading-none tracking-widest text-foreground sm:text-5xl lg:text-6xl">
                Times, lines,
                <span className="block text-primary">timelines!</span>
              </h2>
              <div className="mt-4 h-1.5 w-24 bg-primary" />
            </div>
          </div>
          <div
            ref={chartsRef}
            className={`relative mx-4 ${revealClass(chartsHydrated, chartsInView, "animate-fade-up")}`}
          >
            <DashboardPanel
              timelineData={marketingTimelineData}
              courses={marketingCourses}
              bare
              separated
            />
          </div>
        </div>
      </section>

      {/* CTA + FOOTER */}
      <section
        data-nav-tone="dark"
        className="relative bg-foreground text-white pb-8 overflow-hidden -mt-px"
      >
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, white 0px, white 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, white 0px, white 1px, transparent 1px, transparent 40px)",
          }}
        />
        <div
          data-nav-tone="light"
          className="h-12 bg-background"
          style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }}
        />
        <div className="relative mx-auto max-w-4xl px-6 pt-10 text-center">
          <div
            data-nav-tone="light"
            ref={ctaRef}
            className={`${revealClass(ctaHydrated, ctaInView, "animate-fade-up")} relative mx-auto max-w-2xl rounded-xl bg-[#fff8f1] px-6 py-10 text-foreground sm:px-10`}
          >
            <Tape className="-top-3 left-1/2 -translate-x-1/2 rotate-[-2deg]" />
            <div className="space-y-1">
              <div>
                <span className="font-futura-bold font-black uppercase tracking-widest text-foreground text-3xl sm:text-4xl">
                  READY TO TAKE
                </span>
              </div>
              <div className="pl-8">
                <span className="font-futura-bold font-black uppercase tracking-widest text-foreground text-3xl sm:text-4xl">
                  CONTROL?
                </span>
              </div>
            </div>
            <p className="mx-auto mt-8 max-w-md text-muted-foreground">
              You can do great. Believe in yourself!
            </p>
            <div className="mt-7 flex justify-center">
              <Button
                size="lg"
                className="gap-2 rounded-md bg-primary px-7 text-white transition-all hover:-translate-y-0.5 hover:bg-primary/90"
                onClick={() => void signIn("google")}
              >
                <GoogleIcon />
                Start tracking
              </Button>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center gap-1.5">
            <p className="text-xs text-white/65">Made with ♥ by @aayanh7</p>
            <a
              href="https://www.buymeacoffee.com/aayanh7"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-white/65 hover:text-white transition-colors animate-coffee-bounce inline-block"
            >
              ☕ buy me a coffee (if you want!)
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
