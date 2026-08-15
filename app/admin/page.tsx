"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowLeft, BarChart3, MessageSquare } from "lucide-react";
import { isAdminEmail } from "@/lib/is-admin";
import { AdminOverview } from "@/components/admin/admin-overview";
import { FeedbackBoard } from "@/components/admin/feedback-board";

const Tape = ({ className = "" }: { className?: string }) => (
  <span
    aria-hidden="true"
    className={`pointer-events-none absolute h-5 w-24 bg-primary/15 ${className}`}
  />
);

type Tab = "overview" | "feedback";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [tab, setTab] = useState<Tab>("overview");

  const isAdmin = isAdminEmail(session?.user?.email);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Image
          src="/coursegrade.png"
          alt="CourseGrade"
          width={48}
          height={48}
          className="h-12 w-12 animate-pulse"
        />
      </div>
    );
  }

  if (status !== "authenticated" || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="font-futura-bold text-2xl font-black uppercase text-foreground">
            Access Denied
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            The admin overview is only available to CourseGrade admins.
          </p>
          <Link
            href="/dashboard"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "feedback", label: "Feedback", icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden bg-foreground text-white">
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, white 0px, white 1px, transparent 1px, transparent 42px), repeating-linear-gradient(90deg, white 0px, white 1px, transparent 1px, transparent 42px)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-5 py-12 sm:px-8">
          <div className="mb-7 flex items-center justify-between">
            <div className="flex w-fit items-center gap-3 rounded-sm border border-white/15 bg-white/[0.06] px-4 py-3">
              <Image
                src="/coursegrade.png"
                alt="CourseGrade"
                width={36}
                height={36}
                className="h-9 w-9"
              />
              <span className="font-etna text-2xl text-white">coursegrade.</span>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </div>
          <div className="relative w-fit rounded-sm border-2 border-primary/30 bg-[#fff8f1] px-5 py-3 text-foreground">
            <Tape className="-top-3 left-8 rotate-[-3deg]" />
            <h1 className="font-futura-bold text-3xl font-black uppercase tracking-wide sm:text-5xl">
              Platform Admin
            </h1>
          </div>
          <p className="mt-5 max-w-xl text-sm leading-6 text-white/65">
            Usage analytics and user feedback for CourseGrade.
          </p>
        </div>
        <div
          className="h-10 bg-background"
          style={{ clipPath: "polygon(0 100%, 100% 0, 100% 100%)" }}
        />
      </section>

      <main className="mx-auto max-w-6xl px-5 pb-14 pt-6 sm:px-8">
        <div className="mb-6 inline-flex gap-1 rounded-lg border-2 border-primary/20 bg-[#fff8f1] p-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                tab === id
                  ? "bg-primary text-white"
                  : "text-foreground/70 hover:bg-primary/10"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {tab === "overview" ? <AdminOverview /> : <FeedbackBoard />}
      </main>
    </div>
  );
}
