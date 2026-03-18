"use client";

import { signIn } from "next-auth/react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { GpaTimelineChart } from "@/components/gpa-timeline-chart";
import { GradeDistributionChart } from "@/components/grade-distribution-chart";
import Image from "next/image";
import {
  marketingCourses,
  marketingFeatures,
  marketingHighlights,
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
                <span className="font-etna text-3xl" style={{ color: "white" }}>coursegrade.</span>
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
                Ditch those spreadsheets. Marry us instead! Sign in and find the
                next love of your life.
              </p>

              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <Button
                  size="lg"
                  className="bg-primary text-white px-8 hover:bg-primary/90 [box-shadow:4px_4px_0_rgba(77,31,26,0.6)] hover:translate-y-px hover:[box-shadow:2px_2px_0_rgba(77,31,26,0.6)] transition-all"
                  onClick={() => signIn("google")}
                >
                  SIGN IN W/ GOOGLE
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
      <section className="bg-primary/10 border-y border-primary/20 py-20">
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

      {/* HIGHLIGHTS — dark band */}
      <section className="bg-foreground text-white pt-20 pb-0">
        <div className="mx-auto max-w-7xl px-6 lg:px-12">
          <div className="grid gap-px md:grid-cols-3 border border-white/10">
            {marketingHighlights.map((h) => (
              <div
                key={h.value}
                className="bg-white/5 p-8 hover:bg-primary/80 transition-colors group"
              >
                <p className="text-2xl font-bold text-primary group-hover:text-white transition-colors">
                  {h.value}
                </p>
                <p className="mt-2 text-xs uppercase tracking-widest text-white/50 group-hover:text-white/70 transition-colors">
                  {h.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-foreground text-white pt-16 pb-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
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
              className="bg-primary text-white px-10 hover:bg-primary/90 [box-shadow:4px_4px_0_rgba(77,31,26,0.7)] hover:translate-y-px hover:[box-shadow:2px_2px_0_rgba(77,31,26,0.7)] transition-all"
              onClick={() => signIn("google")}
            >
              Sign in with Google
            </Button>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <section className="bg-foreground border-t border-white/10 py-6 text-center space-y-2">
        <p className="text-xs text-white/40">Made with ♥ by @aayanh7</p>
        <motion.a
          href="https://www.buymeacoffee.com/aayanh7"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-white/30 hover:text-white/60 transition-colors"
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
        >
          ☕ buy me a coffee (if you want!)
        </motion.a>
      </section>
    </div>
  );
}
