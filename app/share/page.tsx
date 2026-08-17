"use client";

import { useEffect, useState } from "react";
import { calculateCourseGrade, getLetterGrade, getLetterGradeColor, calculateGPA } from "@/lib/grade-utils";
import type { GradeScale } from "@/lib/types";
import { DEFAULT_GRADE_SCALE } from "@/lib/types";
import Image from "next/image";

interface SharedCriterion {
  name: string;
  weight: number;
  score: number;
  dropLowest?: number;
  extraCredit?: number;
  subItems?: { id: string; name: string; score: number; weight?: number }[];
}

interface SharedCourse {
  name: string;
  credits: number;
  isPassFail?: boolean;
  percentBoost?: number;
  criteria: SharedCriterion[];
  gradeScale?: GradeScale[];
}

interface SharedSemester {
  name: string;
  courses: SharedCourse[];
}

export default function SharePage() {
  const [semester, setSemester] = useState<SharedSemester | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const data = params.get("data");
      if (!data) {
        setError("No data found in this share link.");
        return;
      }
      const parsed = JSON.parse(data) as SharedSemester;
      if (!parsed.name || !Array.isArray(parsed.courses)) {
        setError("Invalid share link data.");
        return;
      }
      setSemester(parsed);
    } catch {
      setError("Could not decode share link. It may be corrupted or expired.");
    }
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
        <div>
          <Image src="/coursegrade.png" alt="CourseGrade" width={48} height={48} className="mx-auto mb-4 h-12 w-12" />
          <p className="text-lg font-semibold text-foreground">Invalid Share Link</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!semester) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Image src="/coursegrade.png" alt="CourseGrade" width={40} height={40} className="h-10 w-10 animate-pulse" />
      </div>
    );
  }

  const coursesForGpa = semester.courses.map((c) => ({
    id: c.name,
    name: c.name,
    credits: c.credits,
    isPassFail: c.isPassFail ?? false,
    percentBoost: c.percentBoost ?? 0,
    criteria: c.criteria.map((cr) => ({
      id: cr.name,
      name: cr.name,
      weight: cr.weight,
      score: cr.score,
      dropLowest: cr.dropLowest ?? 0,
      extraCredit: cr.extraCredit ?? 0,
      subItems: cr.subItems ?? [],
    })),
    gradeScale: c.gradeScale ?? DEFAULT_GRADE_SCALE,
    collapsed: false,
    headerColor: null,
  }));
  const gpa = calculateGPA(coursesForGpa);

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <Image src="/coursegrade.png" alt="CourseGrade" width={28} height={28} className="h-7 w-7" />
          <span className="text-sm font-semibold text-muted-foreground">coursegrade.</span>
        </div>

        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold uppercase tracking-widest bg-primary text-white px-6 py-1.5">
            {semester.name}
          </h1>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Semester GPA</p>
            <p className="text-3xl font-bold text-primary">{gpa.toFixed(2)}</p>
          </div>
        </div>

        <div className="space-y-4">
          {semester.courses.map((course, i) => {
            const criteria = course.criteria.map((cr) => ({
              id: cr.name + i,
              name: cr.name,
              weight: cr.weight,
              score: cr.score,
              dropLowest: cr.dropLowest ?? 0,
              extraCredit: cr.extraCredit ?? 0,
              subItems: cr.subItems ?? [],
            }));
            const gradeScale = course.gradeScale ?? DEFAULT_GRADE_SCALE;
            const numeric = calculateCourseGrade(criteria, course.percentBoost ?? 0);
            const letter = getLetterGrade(numeric, gradeScale);
            const color = getLetterGradeColor(letter, gradeScale);
            return (
              <div key={course.name} className="rounded-lg border-2 border-primary/30 bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{course.name}</p>
                    <p className="text-xs text-muted-foreground">{course.credits} credits{course.isPassFail ? " · Pass/Fail" : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold" style={{ color }}>{letter}</p>
                    <p className="text-sm text-muted-foreground">{numeric.toFixed(1)}%</p>
                  </div>
                </div>
                {criteria.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {criteria.map((cr, j) => {
                      const crScore = cr.subItems && cr.subItems.length > 0
                        ? cr.subItems.reduce((s, si) => s + si.score, 0) / cr.subItems.length
                        : cr.score;
                      return (
                        <div key={cr.id} className="flex items-center justify-between rounded border border-border/50 bg-background/60 px-3 py-1.5 text-sm">
                          <span className="text-muted-foreground">{cr.name || "—"}</span>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-muted-foreground/70">{cr.weight}%</span>
                            <span className="font-medium text-foreground">{crScore.toFixed(1)}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground/50">
          Shared via <a href="/" className="underline hover:text-primary">coursegrade.</a>
        </p>
      </div>
    </div>
  );
}
