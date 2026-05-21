"use client";

import { signIn } from "next-auth/react";
import Image from "next/image";
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
    className={`relative inline-flex items-center justify-center rounded-sm bg-[#fff8f1] px-6 py-2 font-futura-bold font-black uppercase tracking-widest text-foreground shadow-none ${border ? "border-2 border-primary/30" : ""} ${className}`}
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
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* HERO */}
      <section className="relative bg-foreground text-white overflow-hidden">
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
                    Failing your prelims?
                  </BlockHeading>
                </div>
                <div className="pl-4">
                  <BlockHeading
                    border={false}
                    className="rotate-[0.8deg] text-3xl leading-none sm:text-5xl"
                  >
                    Track how to fix them!
                  </BlockHeading>
                </div>
              </div>

              <p className="text-lg text-white/70 max-w-lg mx-auto text-center">
                Divorce those spreadsheets. Marry us instead! Sign in and find
                the next love of your life.
              </p>

              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <Button
                  size="lg"
                  className="gap-2 rounded-md border border-white/20 bg-primary px-8 text-white shadow-none transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-none"
                  onClick={() => signIn("google")}
                >
                  <GoogleIcon />
                  Sign In!
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Diagonal cut */}
        <div
          className="relative h-14 bg-background"
          style={{ clipPath: "polygon(0 100%, 100% 0, 100% 100%)" }}
        />
      </section>

      {/* FEATURES */}
      <section id="feature-grid" className="relative bg-background py-20">
        <div className="mx-auto max-w-[1400px] px-2 lg:px-4">
          <h2 className="mb-6 -rotate-2 px-4 text-center font-futura-bold font-black uppercase tracking-widest text-foreground text-3xl md:sr-only">
            See your progress at a glance
          </h2>
          <div
            ref={featuresRef}
            className={`grid gap-6 px-4 md:grid-cols-3 md:grid-rows-2 ${featuresInView ? "animate-fade-up" : "opacity-0"}`}
          >
            {marketingFeatures.map((feature, i) => {
              const isHero = i === 0;
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
                  key={feature.title}
                  className={`${featuresInView ? "animate-fade-up-sm" : "opacity-0"} relative rounded-lg border-2 border-white/15 text-center text-white shadow-none ${layout}`}
                  style={{
                    animationDelay: featuresInView ? `${i * 0.1}s` : undefined,
                    backgroundColor: ["#a8473d", "#c56b5e", "#8f3a32"][i] ?? "#b5564b",
                  }}
                >
                  {isHero && (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 560 200"
                      preserveAspectRatio="xMinYMin meet"
                      className="pointer-events-none absolute -left-11 -top-14 hidden h-[60%] w-[80%] overflow-visible md:block"
                      fill="currentColor"
                    >
                      <defs>
                        <path
                          id="hdr-curve"
                          d="M 22,118 L 22,52 C 22,32 28,24 48,24 L 552,24"
                          fill="none"
                        />
                      </defs>
                      <text
                        className="font-futura-bold font-black uppercase text-foreground"
                        style={{ letterSpacing: "0.01em", fontSize: "20px" }}
                      >
                        <textPath href="#hdr-curve" startOffset="14">
                          See your progress at a glance
                        </textPath>
                      </text>
                    </svg>
                  )}
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
                  <span
                    aria-hidden="true"
                    className="absolute right-0 top-0 h-10 w-10 rounded-bl-lg border-b border-l border-white/15 bg-white/5"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CHARTS */}
      <section className="bg-background pb-16">
        <div className="mx-auto max-w-[1400px] px-2 lg:px-4">
          <div
            className={`mx-4 mb-4 flex justify-end ${chartsInView ? "animate-fade-up" : "opacity-0"}`}
          >
            <h2 className="rotate-[1.5deg] font-futura-bold font-black uppercase tracking-widest text-foreground text-2xl sm:text-3xl">
              Times, lines, timelines!
            </h2>
          </div>
          <div
            ref={chartsRef}
            className={`relative mx-4 rounded-xl border-2 border-primary/20 bg-[#fff8f1] p-3 shadow-none sm:p-5 ${chartsInView ? "animate-fade-up" : "opacity-0"}`}
          >
            <Tape className="-top-3 left-10 rotate-[-2deg]" />
            <Tape className="-top-3 right-10 rotate-[3deg]" />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-0 top-0 h-12 w-12 rounded-bl-xl border-b border-l border-primary/15 bg-primary/5"
            />
            <DashboardPanel
              timelineData={marketingTimelineData}
              courses={marketingCourses}
              bare
            />
          </div>
        </div>
      </section>

      {/* CTA + FOOTER */}
      <section className="relative bg-foreground text-white pb-8 overflow-hidden -mt-px">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, white 0px, white 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, white 0px, white 1px, transparent 1px, transparent 40px)",
          }}
        />
        <div
          className="h-12 bg-background"
          style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }}
        />
        <div className="relative mx-auto max-w-4xl px-6 pt-10 text-center">
          <div
            ref={ctaRef}
            className={`${ctaInView ? "animate-fade-up" : "opacity-0"} relative mx-auto max-w-2xl rounded-xl bg-[#fff8f1] px-6 py-10 text-foreground shadow-none sm:px-10`}
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
              Start actually knowing your GPA. It's free. No excuses.
            </p>
          </div>

          <div className="mt-10 flex flex-col items-center gap-1.5">
            <p className="text-xs text-white/40">Made with ♥ by @aayanh7</p>
            <a
              href="https://www.buymeacoffee.com/aayanh7"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-white/30 hover:text-white/60 transition-colors animate-coffee-bounce inline-block"
            >
              ☕ buy me a coffee (if you want!)
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
