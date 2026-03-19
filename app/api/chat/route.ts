import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const RATE_LIMIT = 20;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_MESSAGE_LENGTH = 2000;

const SYSTEM_PROMPT = `You are a smart academic assistant built into CourseGrade, a grade tracking app. You have full visibility into the student's entire academic history across all semesters.

{COURSES_CONTEXT}

You can answer any question about grades, GPA, strengths, weaknesses, trends, and study priorities. Examples:
- "What should I focus on to raise my GPA?"
- "Which course is hurting me the most?"
- "What grade do I need on my final to get an A?"
- "How does this semester compare to last semester?"
- "What's my weakest criterion in Physics?"

You can modify anything — courses, criteria, sub-items, and semesters.
Course/criteria/sub-item actions target the ACTIVE semester. Semester actions can target any semester by its ID.

When performing an action, respond with ONLY a valid JSON object:
{ "reply": "friendly confirmation", "action": { "type": "...", ...params } }

For questions only: { "reply": "your answer" }

AVAILABLE ACTIONS:

Semester actions (use semesterId from context):
- add_semester: { type: "add_semester", name: "..." }
- delete_semester: { type: "delete_semester", semesterId: "..." }
- rename_semester: { type: "rename_semester", semesterId: "...", newName: "..." }
- duplicate_semester: { type: "duplicate_semester", semesterId: "..." }

Course actions (active semester only, use courseId):
- add_course: { type: "add_course", name: "...", credits: 3 }
- delete_course: { type: "delete_course", courseId: "..." }
- duplicate_course: { type: "duplicate_course", courseId: "..." }
- rename_course: { type: "rename_course", courseId: "...", newName: "..." }
- set_credits: { type: "set_credits", courseId: "...", credits: 0 }
- set_pass_fail: { type: "set_pass_fail", courseId: "...", isPassFail: true }
- set_percent_boost: { type: "set_percent_boost", courseId: "...", percentBoost: 0 }

Criterion actions (use courseId + criterionId):
- add_criterion: { type: "add_criterion", courseId: "...", criterion: { name: "...", weight: 0, score: 0 } }
- remove_criterion: { type: "remove_criterion", courseId: "...", criterionId: "..." }
- update_criterion: { type: "update_criterion", courseId: "...", criterionId: "...", changes: { name?: "...", weight?: 0, score?: 0, extraCredit?: 0, dropLowest?: 0 } }

Sub-item actions (use courseId + criterionId + subItemId):
- add_sub_item: { type: "add_sub_item", courseId: "...", criterionId: "...", subItem: { name: "...", score: 0, weight?: 0 } }
- update_sub_item: { type: "update_sub_item", courseId: "...", criterionId: "...", subItemId: "...", changes: { name?: "...", score?: 0, weight?: 0 } }
- remove_sub_item: { type: "remove_sub_item", courseId: "...", criterionId: "...", subItemId: "..." }

Rules:
- Use exact IDs from the context
- Be specific and actionable in suggestions
- Replies can be 1-4 sentences; use newlines when listing multiple points
- Return ONLY the JSON object, no markdown, no code fences
- Never use the word "applied" or "apply"`;

function getWindowKey(): string {
  const bucket = Math.floor(Date.now() / WINDOW_MS);
  return `chat-5m-${bucket}`;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: {
    message?: string;
    history?: { role: string; content: string }[];
    context?: {
      semesters?: unknown;
      activeSemesterId?: string | null;
    };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const message = (typeof body.message === "string" ? body.message : "").trim();
  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: "Message too long (max 2000 chars)" },
      { status: 400 },
    );
  }

  // Rate limit — reuse the syllabus_rate_limits table with a chat-specific key
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const windowKey = getWindowKey();

  await supabase
    .from("syllabus_rate_limits")
    .delete()
    .eq("user_id", userId)
    .lt("updated_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

  const { data: limitRow } = await supabase
    .from("syllabus_rate_limits")
    .select("request_count")
    .eq("user_id", userId)
    .eq("window_key", windowKey)
    .single();

  const currentCount = limitRow?.request_count ?? 0;
  if (currentCount >= RATE_LIMIT) {
    const msUntilReset = WINDOW_MS - (Date.now() % WINDOW_MS);
    return NextResponse.json(
      {
        error: `You've sent ${RATE_LIMIT} messages in this window. Try again in ${Math.ceil(msUntilReset / 1000)} seconds.`,
        code: "RATE_LIMITED",
        retryAfterSeconds: Math.ceil(msUntilReset / 1000),
      },
      { status: 429 },
    );
  }

  // Build courses context string covering all semesters
  const context = body.context ?? {};
  const activeSemesterId = context.activeSemesterId ?? null;

  type SubItemCtx = { id: string; name: string; score: number; weight?: number };
  type CrCtx = {
    id: string; name: string; weight: number; score: number;
    extraCredit?: number; dropLowest?: number; subItems?: SubItemCtx[];
  };
  type CourseCtx = {
    id: string; name: string; credits: number; isPassFail?: boolean;
    percentBoost?: number; criteria: CrCtx[];
  };
  type SemCtx = { id: string; name: string; courses: CourseCtx[] };

  // Inline grade calculation (mirrors lib/grade-utils.ts)
  function calcCriterionScore(cr: CrCtx): number {
    if (cr.subItems && cr.subItems.length > 0) {
      const items = cr.subItems;
      const hasWeights = items.some((i) => i.weight !== undefined && i.weight > 0);
      const drop = Math.min(cr.dropLowest ?? 0, items.length - 1);
      let eff = drop > 0
        ? [...items].sort((a, b) => a.score - b.score).slice(drop)
        : items;
      if (eff.length === 0) return 0;
      if (hasWeights) return eff.reduce((s, i) => s + i.score * (i.weight ?? 0) / 100, 0);
      return eff.reduce((s, i) => s + i.score, 0) / eff.length;
    }
    return cr.score;
  }

  function calcCourseGrade(course: CourseCtx): number {
    const totalWeight = course.criteria.reduce((s, c) => s + c.weight, 0);
    const boost = Math.max(0, course.percentBoost ?? 0);
    if (totalWeight === 0) return boost;
    const score = course.criteria.reduce((s, c) => {
      return s + (calcCriterionScore(c) + Math.max(0, c.extraCredit ?? 0)) * c.weight / 100;
    }, 0);
    return Math.round((score + boost) * 100) / 100;
  }

  const gpaMap: Record<string, number> = {
    "A+": 4.3, A: 4.0, "A-": 3.7, "B+": 3.3, B: 3.0, "B-": 2.7,
    "C+": 2.3, C: 2.0, "C-": 1.7, "D+": 1.3, D: 1.0, "D-": 0.7, F: 0.0,
  };
  function numericToLetter(g: number): string {
    if (g >= 96) return "A+"; if (g >= 93) return "A"; if (g >= 90) return "A-";
    if (g >= 87) return "B+"; if (g >= 83) return "B"; if (g >= 80) return "B-";
    if (g >= 77) return "C+"; if (g >= 73) return "C"; if (g >= 70) return "C-";
    if (g >= 67) return "D+"; if (g >= 63) return "D"; if (g >= 60) return "D-";
    return "F";
  }

  let coursesContext = "No data available.";

  if (Array.isArray(context.semesters) && context.semesters.length > 0) {
    const semesters = context.semesters as SemCtx[];
    const lines: string[] = [];

    for (const sem of semesters) {
      const isActive = sem.id === activeSemesterId;
      lines.push(`\n=== Semester: "${sem.name}" (semesterId: ${sem.id})${isActive ? " [ACTIVE — can be modified]" : ""} ===`);

      if (!Array.isArray(sem.courses) || sem.courses.length === 0) {
        lines.push("  No courses.");
        continue;
      }

      let semTotalPoints = 0, semTotalCredits = 0;
      for (const course of sem.courses) {
        const numeric = calcCourseGrade(course);
        const letter = course.isPassFail ? (numeric >= 60 ? "P" : "F") : numericToLetter(numeric);
        const gpa = course.isPassFail ? null : (gpaMap[letter] ?? 0);
        lines.push(
          `\n  Course: "${course.name}" (id: ${course.id}, ${course.credits} cr) → ${numeric.toFixed(1)}% ${letter}${gpa !== null ? ` [${gpa.toFixed(1)} GPA pts]` : " [Pass/Fail]"}`,
        );
        if (Array.isArray(course.criteria) && course.criteria.length > 0) {
          for (const cr of course.criteria) {
            const crScore = calcCriterionScore(cr);
            lines.push(
              `    • "${cr.name}" (id: ${cr.id}): weight ${cr.weight}%, score ${crScore.toFixed(1)}%` +
              (cr.extraCredit ? ` +${cr.extraCredit}% EC` : ""),
            );
            if (cr.subItems && cr.subItems.length > 0) {
              for (const si of cr.subItems) {
                lines.push(
                  `      - "${si.name}" (subItemId: ${si.id}): ${si.score.toFixed(1)}%${si.weight ? ` (weight ${si.weight}%)` : ""}`,
                );
              }
            }
          }
        } else {
          lines.push("    (no criteria)");
        }
        if (!course.isPassFail && gpa !== null) {
          semTotalPoints += gpa * course.credits;
          semTotalCredits += course.credits;
        }
      }

      if (semTotalCredits > 0) {
        lines.push(`\n  Semester GPA: ${(semTotalPoints / semTotalCredits).toFixed(2)}`);
      }
    }

    coursesContext = lines.join("\n");
  }

  const systemPrompt = SYSTEM_PROMPT.replace("{COURSES_CONTEXT}", coursesContext);

  // Call Gemini
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    systemInstruction: systemPrompt,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
  });

  // Build history for multi-turn context (Gemini alternates user/model roles)
  const rawHistory = Array.isArray(body.history) ? body.history : [];
  const geminiHistory = rawHistory
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  let reply: string;
  let action: Record<string, unknown> | undefined;

  try {
    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    let parsed: { reply?: unknown; action?: unknown };
    try {
      parsed = JSON.parse(responseText) as { reply?: unknown; action?: unknown };
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]) as { reply?: unknown; action?: unknown };
        } catch {
          parsed = { reply: responseText };
        }
      } else {
        parsed = { reply: responseText };
      }
    }

    reply =
      typeof parsed.reply === "string" && parsed.reply.trim()
        ? parsed.reply.trim()
        : "Done!";
    action =
      parsed.action && typeof parsed.action === "object"
        ? (parsed.action as Record<string, unknown>)
        : undefined;
  } catch (err) {
    console.error("[chat] Gemini error:", err);
    return NextResponse.json(
      { error: "Sservice error. Please try again." },
      { status: 502 },
    );
  }

  // Increment rate limit after success
  await supabase.from("syllabus_rate_limits").upsert({
    user_id: userId,
    window_key: windowKey,
    request_count: currentCount + 1,
    updated_at: new Date().toISOString(),
  });

  return NextResponse.json({ reply, action });
}
