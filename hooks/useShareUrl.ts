"use client";

import { useState, useCallback } from "react";
import type { Semester } from "@/lib/types";
import { SAVE_SUCCESS_DURATION_MS } from "@/lib/constants";

interface UseShareUrlParams {
  semesters: Semester[];
  activeSemesterId: string | null;
}

export function useShareUrl({ semesters, activeSemesterId }: UseShareUrlParams) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  const generateShareUrl = useCallback(() => {
    const semester = semesters.find((s) => s.id === activeSemesterId);
    if (!semester) return;
    const payload = {
      name: semester.name,
      courses: semester.courses.map((c) => ({
        name: c.name,
        credits: c.credits,
        isPassFail: c.isPassFail,
        percentBoost: c.percentBoost,
        criteria: c.criteria.map((cr) => ({
          name: cr.name,
          weight: cr.weight,
          score: cr.score,
          dropLowest: cr.dropLowest,
          extraCredit: cr.extraCredit,
          subItems: cr.subItems,
        })),
        gradeScale: c.gradeScale,
      })),
    };
    const encoded = encodeURIComponent(JSON.stringify(payload));
    setShareUrl(`${window.location.origin}/share?data=${encoded}`);
    setShareCopied(false);
  }, [semesters, activeSemesterId]);

  const closeShareUrl = useCallback(() => setShareUrl(null), []);

  const copyShareUrl = useCallback(() => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), SAVE_SUCCESS_DURATION_MS);
  }, [shareUrl]);

  return { shareUrl, shareCopied, generateShareUrl, closeShareUrl, copyShareUrl };
}
