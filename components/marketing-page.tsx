"use client";

import { signIn } from "next-auth/react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

const GoogleIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4 fill-white shrink-0"
    aria-hidden="true"
  >
    <path d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z" />
  </svg>
);
import { GpaTimelineChart } from "@/components/gpa-timeline-chart";
import { GradeDistributionChart } from "@/components/grade-distribution-chart";
import Image from "next/image";
import {
  marketingCourses,
  marketingFeatures,
  marketingTimelineData,
} from "@/app/page-marketing-data";

const BlockHeading = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <span
    className={`inline-block font-bold uppercase tracking-widest bg-primary text-white px-6 py-2 [box-shadow:5px_5px_0_rgba(77,31,26,0.55),10px_10px_0_rgba(77,31,26,0.25)] ${className}`}
  >
    {children}
  </span>
);

export function MarketingPage() {
  const scrollToFeatures = () => {
    if (typeof document === "undefined") return;
    document
      .getElementById("feature-grid")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="w-full space-y-6"
            >
              <div className="flex items-center justify-center gap-3">
                <motion.div
                  animate={{ rotate: [-4, 4, -3] }}
                  transition={{
                    repeat: Infinity,
                    duration: 6,
                    ease: "easeInOut",
                  }}
                >
                  <Image
                    src="/coursegrade.png"
                    alt="CourseGrade"
                    width={48}
                    height={48}
                    className="h-12 w-12"
                  />
                </motion.div>
                <span className="font-etna text-3xl text-white">
                  coursegrade.
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <BlockHeading className="text-3xl sm:text-5xl leading-none">
                    Failing your prelims?
                  </BlockHeading>
                </div>
                <div className="pl-4">
                  <BlockHeading className="text-3xl sm:text-5xl leading-none">
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
                  className="gap-2 bg-primary text-white px-8 hover:bg-primary/90 [box-shadow:4px_4px_0_rgba(77,31,26,0.6)] hover:translate-y-px hover:[box-shadow:2px_2px_0_rgba(77,31,26,0.6)] transition-all"
                  onClick={() => signIn("google")}
                >
                  <GoogleIcon />
                  Sign In!
                </Button>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Diagonal cut */}
        <div
          className="h-12 bg-background"
          style={{ clipPath: "polygon(0 100%, 100% 0, 100% 100%)" }}
        />
      </section>

      {/* FEATURES */}
      <section id="feature-grid" className="bg-background py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
            className="mb-12"
          >
            <BlockHeading className="text-2xl">Built for students</BlockHeading>
          </motion.div>
          <div className="grid gap-0 md:grid-cols-3 border border-primary/20">
            {marketingFeatures.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="group p-8 border-r border-b border-primary/20 last:border-r-0 bg-card/60 hover:bg-primary hover:text-white transition-colors duration-300"
                >
                  <div className="flex h-12 w-12 items-center justify-center border border-primary/30 bg-primary/10 text-primary group-hover:border-white/30 group-hover:bg-white/10 group-hover:text-white mb-6 transition-colors">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold uppercase tracking-wide mb-3 group-hover:text-white">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground group-hover:text-white/80 transition-colors">
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CHARTS — full bleed primary band */}
      <section className="bg-background py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6 }}
            className="mb-10"
          >
            <BlockHeading className="text-2xl">
              See your progress at a glance
            </BlockHeading>
          </motion.div>
          <div className="grid gap-6 lg:grid-cols-2">
            <GpaTimelineChart data={marketingTimelineData} />
            <GradeDistributionChart
              title="Overall Grade Distribution"
              courses={marketingCourses}
            />
          </div>
        </div>
      </section>

      {/* CTA + FOOTER */}
      <section className="relative bg-foreground text-white pb-10 overflow-hidden">
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
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            <div className="space-y-3">
              <div>
                <BlockHeading className="text-3xl sm:text-4xl">
                  READY TO TAKE
                </BlockHeading>
              </div>
              <div className="pl-8">
                <BlockHeading className="text-3xl sm:text-4xl">
                  CONTROL?
                </BlockHeading>
              </div>
            </div>
            <p className="text-white/60 max-w-md mx-auto">
              Start actually knowing your GPA. It's free. No excuses.
            </p>
            <Button
              size="lg"
              className="gap-2 bg-primary text-white px-10 hover:bg-primary/90 [box-shadow:4px_4px_0_rgba(77,31,26,0.7)] hover:translate-y-px hover:[box-shadow:2px_2px_0_rgba(77,31,26,0.7)] transition-all"
              onClick={() => signIn("google")}
            >
              <GoogleIcon />
              Sign In!
            </Button>
          </motion.div>

          <div className="mt-16 flex flex-col items-center gap-1.5 pt-6">
            <p className="text-xs text-white/40">Made with ♥ by @aayanh7</p>
            <motion.a
              href="https://www.buymeacoffee.com/aayanh7"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-white/30 hover:text-white/60 transition-colors"
              animate={{ y: [0, -4, 0] }}
              transition={{
                repeat: Infinity,
                duration: 2.4,
                ease: "easeInOut",
              }}
            >
              ☕ buy me a coffee (if you want!)
            </motion.a>
          </div>
        </div>
      </section>
    </div>
  );
}
