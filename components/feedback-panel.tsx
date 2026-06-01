"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Star, Send, X, ChevronRight, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";

const paperTapeClass =
  "pointer-events-none absolute -top-2 h-5 w-16 bg-primary/12";

type Phase = "rating" | "comment" | "thanks";

export function FeedbackPanel() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("rating");
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const reset = useCallback(() => {
    setPhase("rating");
    setRating(0);
    setHoveredStar(0);
    setComment("");
    setSubmitError("");
    setSubmitting(false);
  }, []);

  const handleClose = () => {
    setOpen(false);
    setTimeout(reset, 300);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      const response = await fetch("/api/feedback/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim() }),
      });
      if (!response.ok) throw new Error("Failed to send feedback.");
    } catch {
      setSubmitting(false);
      setSubmitError("Could not send feedback. Please try again.");
      return;
    }
    setSubmitting(false);
    setPhase("thanks");
    setTimeout(() => {
      handleClose();
    }, 1800);
  };

  return (
    <div ref={panelRef} className="pointer-events-none fixed right-0 top-1/2 z-[60] -translate-y-1/2 print:hidden">
      <motion.button
        type="button"
        onClick={() => { setOpen((p) => !p); if (!open) reset(); }}
        animate={{ x: open ? -300 : 0 }}
        initial={false}
        transition={{ type: "spring", damping: 26, stiffness: 300 }}
        className="pointer-events-auto relative z-[61] flex shrink-0 items-center gap-1.5 rounded-l-lg border-2 border-r-0 border-primary/25 bg-[#fff8f1] px-2 py-3 text-primary transition-colors hover:bg-[#fff3ea]"
        style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
      >
        {/* Vertical tab — attached to panel */}
        <ChevronRight className={`h-3 w-3 rotate-90 transition-transform ${open ? "rotate-[-90deg]" : ""}`} />
        <span className="text-xs font-bold uppercase tracking-widest">Feedback</span>
        <MessageSquare className="h-3.5 w-3.5 rotate-90" />
      </motion.button>

      {/* Panel */}
      <motion.div
        aria-hidden={!open}
        animate={{ x: open ? 0 : 300 }}
        initial={false}
        transition={{ type: "spring", damping: 26, stiffness: 300 }}
        className="fixed right-0 top-1/2 z-[60]"
        style={{ pointerEvents: open ? "auto" : "none" }}
      >
        <div
          className="relative w-[300px] -translate-y-1/2 overflow-hidden rounded-l-xl border-2 border-r-0 border-primary/25 bg-[#fff8f1] shadow-[0_3px_0_rgba(198,90,78,0.20),0_10px_18px_rgba(77,31,26,0.08)]"
        >
            {/* Tape decorations */}
            <div className={`${paperTapeClass} left-8 rotate-[-2deg]`} />
            <div className={`${paperTapeClass} right-6 rotate-[3deg]`} />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-primary/15 bg-[#fff3ea] px-4 pb-3 pt-4">
              <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-primary">
                Feedback
              </h3>
              <button
                type="button"
                aria-label="Close feedback"
                onClick={handleClose}
                className="rounded-full p-1 text-primary/50 transition-colors hover:bg-primary/10 hover:text-primary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Content */}
            <div className="px-4 pb-5 pt-4">
              <AnimatePresence mode="wait">
                {phase === "rating" && (
                  <motion.div
                    key="rating"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                  >
                    <p className="mb-4 text-sm font-medium text-foreground">
                      How would you rate your experience?
                    </p>
                    <div className="mb-5 flex justify-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const filled = star <= (hoveredStar || rating);
                        return (
                          <button
                            key={star}
                            type="button"
                            aria-label={`Rate ${star} ${star === 1 ? "star" : "stars"}`}
                            aria-pressed={rating === star}
                            onClick={() => setRating(star)}
                            onMouseEnter={() => setHoveredStar(star)}
                            onMouseLeave={() => setHoveredStar(0)}
                            className="group rounded-md p-1 transition-transform hover:scale-110"
                          >
                            <Star
                              className={`h-8 w-8 transition-colors ${
                                filled
                                  ? "fill-primary text-primary"
                                  : "fill-transparent text-primary/30 group-hover:text-primary/50"
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                      <span>Poor</span>
                      <span>Excellent</span>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={rating === 0}
                        onClick={() => setPhase("comment")}
                        className="gap-1.5 text-primary hover:bg-primary/10 hover:text-primary disabled:opacity-40"
                      >
                        Next
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {phase === "comment" && (
                  <motion.div
                    key="comment"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                  >
                    <p className="mb-3 text-sm font-medium text-foreground">
                      Tell us about your experience...
                    </p>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="What do you like? What could be better?"
                      rows={4}
                      className="w-full resize-none rounded-lg border-2 border-primary/20 bg-white/80 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40"
                    />
                    <div className="mt-3 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setPhase("rating")}
                        className="text-xs font-medium text-muted-foreground hover:text-foreground"
                      >
                        Back
                      </button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={submitting}
                        onClick={handleSubmit}
                        className="gap-1.5 text-primary hover:bg-primary/10 hover:text-primary"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Submit
                      </Button>
                    </div>
                    {submitError && (
                      <p className="mt-3 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                        {submitError}
                      </p>
                    )}
                  </motion.div>
                )}

                {phase === "thanks" && (
                  <motion.div
                    key="thanks"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className="py-4 text-center"
                  >
                    <p className="text-2xl">&#10024;</p>
                    <p className="mt-2 text-sm font-semibold text-primary">Thank you!</p>
                    <p className="mt-1 text-xs text-muted-foreground">Your feedback helps us improve.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
        </div>
      </motion.div>
    </div>
  );
}
