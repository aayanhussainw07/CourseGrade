"use client";

import { useRef, useCallback, useEffect } from "react";
import type { Semester } from "@/lib/types";
import { deepCopy, sanitizeSemesters, type Snapshot } from "@/app/page-utils";
import { SNAPSHOT_DEBOUNCE_MS } from "@/lib/constants";

interface UseUndoRedoParams {
  semesters: Semester[];
  semesterOrder: string[];
  activeSemesterId: string | null;
  setSemesters: React.Dispatch<React.SetStateAction<Semester[]>>;
  setSemesterOrder: React.Dispatch<React.SetStateAction<string[]>>;
  setActiveSemesterId: React.Dispatch<React.SetStateAction<string | null>>;
  loading: boolean;
}

export function useUndoRedo({
  semesters,
  semesterOrder,
  activeSemesterId,
  setSemesters,
  setSemesterOrder,
  setActiveSemesterId,
  loading,
}: UseUndoRedoParams) {
  const historyRef = useRef<{
    past: Snapshot[];
    future: Snapshot[];
    lastSerialized: string;
  }>({ past: [], future: [], lastSerialized: "" });
  const skipHistoryRef = useRef(false);
  const snapshotDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const captureSnapshot = useCallback((): Snapshot => ({
    semesters: deepCopy(sanitizeSemesters(semesters, semesters)),
    semesterOrder: [...semesterOrder],
    activeSemesterId,
  }), [semesters, semesterOrder, activeSemesterId]);

  const applySnapshot = useCallback((snapshot: Snapshot) => {
    skipHistoryRef.current = true;
    setSemesters((current) => deepCopy(sanitizeSemesters(snapshot.semesters, current)));
    setSemesterOrder([...snapshot.semesterOrder]);
    setActiveSemesterId((currentActive) => {
      if (currentActive && snapshot.semesterOrder.includes(currentActive)) return currentActive;
      const fallbackId = snapshot.activeSemesterId;
      if (fallbackId && snapshot.semesterOrder.includes(fallbackId)) return fallbackId;
      return null;
    });
  }, [setSemesters, setSemesterOrder, setActiveSemesterId]);

  const pushSnapshotIfChanged = useCallback((snapshot: Snapshot) => {
    const serialized = JSON.stringify(snapshot);
    if (!historyRef.current.lastSerialized) {
      historyRef.current.past = [snapshot];
      historyRef.current.lastSerialized = serialized;
      historyRef.current.future = [];
      return;
    }
    if (skipHistoryRef.current) {
      skipHistoryRef.current = false;
      historyRef.current.lastSerialized = serialized;
      return;
    }
    if (serialized !== historyRef.current.lastSerialized) {
      historyRef.current.past.push(snapshot);
      if (historyRef.current.past.length > 50) historyRef.current.past.shift();
      historyRef.current.future = [];
      historyRef.current.lastSerialized = serialized;
    }
  }, []);

  const handleUndo = useCallback(() => {
    if (historyRef.current.past.length <= 1) return;
    const current = historyRef.current.past.pop();
    if (!current) return;
    historyRef.current.future.unshift(current);
    const previous = historyRef.current.past[historyRef.current.past.length - 1];
    if (previous) {
      applySnapshot(previous);
      historyRef.current.lastSerialized = JSON.stringify(previous);
    }
  }, [applySnapshot]);

  const handleRedo = useCallback(() => {
    if (historyRef.current.future.length === 0) return;
    const next = historyRef.current.future.shift();
    if (!next) return;
    historyRef.current.past.push(next);
    applySnapshot(next);
    historyRef.current.lastSerialized = JSON.stringify(next);
  }, [applySnapshot]);

  // Debounced snapshot capture
  useEffect(() => {
    if (loading) return;
    if (snapshotDebounceRef.current) clearTimeout(snapshotDebounceRef.current);
    snapshotDebounceRef.current = setTimeout(() => {
      pushSnapshotIfChanged(captureSnapshot());
      snapshotDebounceRef.current = null;
    }, SNAPSHOT_DEBOUNCE_MS);
    return () => {
      if (snapshotDebounceRef.current) clearTimeout(snapshotDebounceRef.current);
    };
  }, [captureSnapshot, loading, pushSnapshotIfChanged]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (!e.metaKey && !e.ctrlKey) return;
      if (key === "z" && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      else if (key === "y" || (key === "z" && e.shiftKey)) { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [handleUndo, handleRedo]);

  return { handleUndo, handleRedo };
}
