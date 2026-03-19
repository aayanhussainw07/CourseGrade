"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X, Send, Loader2, Sparkles } from "lucide-react";
import type { Semester } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ChatAction =
  // Course operations (active semester)
  | { type: "rename_course"; courseId: string; newName: string }
  | { type: "add_course"; name: string; credits: number }
  | { type: "delete_course"; courseId: string }
  | { type: "duplicate_course"; courseId: string }
  | { type: "set_credits"; courseId: string; credits: number }
  | { type: "set_pass_fail"; courseId: string; isPassFail: boolean }
  | { type: "set_percent_boost"; courseId: string; percentBoost: number }
  // Criterion operations
  | {
      type: "update_criterion";
      courseId: string;
      criterionId: string;
      changes: { name?: string; weight?: number; score?: number; extraCredit?: number; dropLowest?: number };
    }
  | { type: "add_criterion"; courseId: string; criterion: { name: string; weight: number; score?: number } }
  | { type: "remove_criterion"; courseId: string; criterionId: string }
  // Sub-item operations
  | { type: "add_sub_item"; courseId: string; criterionId: string; subItem: { name: string; score: number; weight?: number } }
  | { type: "update_sub_item"; courseId: string; criterionId: string; subItemId: string; changes: { name?: string; score?: number; weight?: number } }
  | { type: "remove_sub_item"; courseId: string; criterionId: string; subItemId: string }
  // Semester operations
  | { type: "add_semester"; name: string }
  | { type: "delete_semester"; semesterId: string }
  | { type: "rename_semester"; semesterId: string; newName: string }
  | { type: "duplicate_semester"; semesterId: string };

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface ChatActionResult {
  applied: number;
  failed: number;
  errors: string[];
}

interface ChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  semesters: Semester[];
  activeSemesterId: string | null;
  onApplyActions: (actions: ChatAction[]) => Promise<ChatActionResult>;
  onOpenSyllabusImport: () => void;
}


let msgIdCounter = 0;
function nextId() {
  return `msg-${++msgIdCounter}`;
}

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi! Tell me to make changes or feel free to ask any questions about your courses.",
};

export function ChatPanel({
  open,
  onOpenChange,
  semesters,
  activeSemesterId,
  onApplyActions,
  onOpenSyllabusImport,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        inputRef.current?.focus();
      }, 150);
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { id: nextId(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = messagesRef.current
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history,
          context: { semesters, activeSemesterId },
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Error ${response.status}`);
      }

      const aiMsg: ChatMessage = {
        id: nextId(),
        role: "assistant",
        content: data.reply ?? "Done!",
      };
      setMessages((prev) => [...prev, aiMsg]);

      // Collect all actions and pass as batch for chained processing
      const actionList: ChatAction[] = [];
      if (Array.isArray(data.actions)) {
        for (const a of data.actions) {
          if (a && typeof a === "object" && typeof a.type === "string") {
            actionList.push(a as ChatAction);
          }
        }
      } else if (data.action && typeof data.action === "object") {
        actionList.push(data.action as ChatAction);
      }
      if (actionList.length > 0) {
        const result = await onApplyActions(actionList);
        // If no actions actually applied, override the AI's reply with honest feedback
        if (result.applied === 0) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsg.id
                ? {
                    ...m,
                    content:
                      "I tried to make those changes but none of them went through. " +
                      (result.errors.length > 0
                        ? result.errors[0]
                        : "Please try again with a more specific request."),
                  }
                : m,
            ),
          );
        } else if (result.failed > 0) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsg.id
                ? {
                    ...m,
                    content:
                      m.content +
                      ` (${result.applied} change${result.applied !== 1 ? "s" : ""} succeeded, ${result.failed} failed)`,
                  }
                : m,
            ),
          );
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: err instanceof Error ? err.message : "Something went wrong.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, semesters, activeSemesterId, onApplyActions]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed right-0 top-0 z-40 flex h-screen w-64 flex-col overflow-hidden border-l border-white/10 bg-foreground text-white"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 40px)",
          }}
        >
          {/* Header */}
          <div className="relative flex items-center justify-between border-b border-white/10 p-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-white">Chat</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages */}
          <div className="relative flex-1 overflow-y-auto space-y-3 px-3 py-3 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col",
                  msg.role === "user" ? "items-end" : "items-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "rounded-tr-sm bg-primary/75 text-white"
                      : "rounded-tl-sm bg-white/10 text-white/90",
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-start">
                <div className="rounded-2xl rounded-tl-sm bg-white/10 px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-white/50" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input section */}
          <div className="relative border-t border-white/10 px-2 pt-2 pb-2 space-y-2">
            {activeSemesterId && (
              <button
                onClick={onOpenSyllabusImport}
                className="flex w-full items-center justify-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/10 cursor-pointer"
              >
                <Sparkles className="h-3 w-3 text-primary/80" />
                Import Syllabus
              </button>
            )}
            <div className="flex items-end gap-1.5">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything..."
                rows={2}
                maxLength={2000}
                className="flex-1 resize-none rounded-xl border border-white/15 bg-white/8 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-white/30 focus:bg-white/12"
                disabled={loading}
              />
              <Button
                onClick={sendMessage}
                size="icon"
                disabled={!input.trim() || loading}
                className="h-9 w-9 shrink-0 bg-primary hover:bg-primary/80 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-center text-[10px] text-white/25">
              Enter to send · Shift+Enter for newline
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
