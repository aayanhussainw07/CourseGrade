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
import { DashboardPanel } from "@/components/dashboard-panel";
import { useInView } from "@/hooks/use-in-view";
import {
  marketingCourses,
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

export function MarketingPage() {
  const { ref: featuresRef, inView: featuresInView } = useInView(0.3);
  const { ref: chartsRef, inView: chartsInView } = useInView(0.2);
  const { ref: ctaRef, inView: ctaInView } = useInView(0.3);

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
        className="relative overflow-hidden bg-background py-20"
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
            className={`grid gap-6 px-4 md:grid-cols-3 md:grid-rows-2 ${featuresInView ? "animate-fade-up" : "opacity-0"}`}
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
                  className={`${featuresInView ? "animate-fade-up-sm" : "opacity-0"} group relative rounded-lg text-center text-white transition-all duration-300 hover:-translate-y-2 hover:rotate-0 ${layout}`}
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

      {/* CHARTS */}
      <section
        data-nav-tone="light"
        className="relative overflow-hidden bg-background pb-16"
      >
        <DoodleField />
        <div className="relative z-10 mx-auto max-w-[1400px] px-2 lg:px-4">
          <div
            className={`mx-4 mb-6 flex justify-start lg:mx-10 ${chartsInView ? "animate-fade-up" : "opacity-0"}`}
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
            className={`relative mx-4 ${chartsInView ? "animate-fade-up" : "opacity-0"}`}
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
            className={`${ctaInView ? "animate-fade-up" : "opacity-0"} relative mx-auto max-w-2xl rounded-xl bg-[#fff8f1] px-6 py-10 text-foreground sm:px-10`}
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
