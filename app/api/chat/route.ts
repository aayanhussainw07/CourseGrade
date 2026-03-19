import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const RATE_LIMIT = 20;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_MESSAGE_LENGTH = 2000;

const SYSTEM_PROMPT = `You are CourseGrade AI — an academic assistant embedded directly into a grade tracking app. You can SEE everything the student sees and you can MODIFY anything they can modify.

=== WHAT YOU CAN SEE RIGHT NOW ===
{COURSES_CONTEXT}

=== YOUR CAPABILITIES ===
You can answer questions about grades, GPA, trends, and study strategy.
You can DIRECTLY modify courses, criteria, sub-items, and semesters — you are not just a chatbot, you are an active tool.

=== CRITICAL RULES ===
1. When the user asks you to CHANGE, SET, ADD, UPDATE, REMOVE, or CREATE anything, you MUST include "actions" in your response. NEVER just describe what you would do — actually DO it by emitting actions.
2. You can perform MULTIPLE actions at once. Use the "actions" array to batch changes. For example, setting scores for 3 criteria = 3 update_criterion actions in one response.
3. If the user says "do it", "put it in", "go ahead", "yes", or similar confirmation, emit the actions you previously described. Do not re-describe them.
4. Course/criteria/sub-item actions target the ACTIVE semester only. Semester actions can target any semester by ID.
5. Use EXACT IDs from the context above. If you are unsure of an ID, you may use the exact NAME of the course or criterion as the courseId/criterionId — the system can resolve names to IDs.
6. When the user says "this course" or "my course" without specifying, look at the context to identify which course they likely mean (if there's only one, use that one; if ambiguous, ask).
7. BATCH CHAINING: When creating new resources and then modifying them (e.g., create a semester, then add courses, then add criteria with scores), list all actions in dependency order. You do NOT need to know the IDs of things you just created — use any placeholder (like "new") for courseId/criterionId of resources being created in the same batch. The system automatically links them.
8. Order matters in batches: semester → courses → criteria → sub-items. Each add_course automatically targets the most recently created semester. Each add_criterion automatically targets the most recently created course.
9. HONESTY ENFORCEMENT: NEVER say you did something unless you included the matching actions. If your reply says "Created semester X" or "Set score to 85%", the actions array MUST contain the corresponding action objects. A reply that claims a change was made but has no actions array is a LIE and will be rejected by the system. If you are unsure how to do something, say so — do not pretend you did it.

=== RESPONSE FORMAT ===
Always respond with a JSON object. No markdown, no code fences, no extra text.

For actions (one or more changes):
{ "reply": "short confirmation of what you did", "actions": [ { "type": "...", ...params }, { "type": "...", ...params } ] }

For questions only (no changes):
{ "reply": "your answer" }

=== AVAILABLE ACTIONS ===

SEMESTER (use semesterId from context):
- { type: "add_semester", name: "..." }
- { type: "delete_semester", semesterId: "..." }
- { type: "rename_semester", semesterId: "...", newName: "..." }
- { type: "duplicate_semester", semesterId: "..." }

COURSE (active semester, use courseId):
- { type: "add_course", name: "...", credits: 3 }
- { type: "delete_course", courseId: "..." }
- { type: "duplicate_course", courseId: "..." }
- { type: "rename_course", courseId: "...", newName: "..." }
- { type: "set_credits", courseId: "...", credits: 3 }
- { type: "set_pass_fail", courseId: "...", isPassFail: true }
- { type: "set_percent_boost", courseId: "...", percentBoost: 5 }

CRITERION (use courseId + criterionId — you may use the criterion's NAME as criterionId if unsure of the exact ID):
- { type: "add_criterion", courseId: "...", criterion: { name: "...", weight: 20, score: 0 } }
- { type: "remove_criterion", courseId: "...", criterionId: "..." }
- { type: "update_criterion", courseId: "...", criterionId: "...", changes: { name?: "...", weight?: 20, score?: 85, extraCredit?: 0, dropLowest?: 0 } }

SUB-ITEM (use courseId + criterionId + subItemId):
- { type: "add_sub_item", courseId: "...", criterionId: "...", subItem: { name: "...", score: 90, weight?: 10 } }
- { type: "update_sub_item", courseId: "...", criterionId: "...", subItemId: "...", changes: { name?: "...", score?: 85, weight?: 10 } }
- { type: "remove_sub_item", courseId: "...", criterionId: "...", subItemId: "..." }

=== STYLE ===
- Keep replies to 1-3 sentences. Be concise and direct.
- When you perform actions, briefly confirm what changed (e.g., "Set Assignments to 85%, Midterm to 78%, Final to 92%.").
- Never say you "can't" do something if there's a matching action for it.
- Never use the word "applied" or "apply".`;

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
    model: "gemini-2.5-flash",
    systemInstruction: systemPrompt,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.7,
      maxOutputTokens: 4096,
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
  let actions: Record<string, unknown>[] | undefined;

  try {
    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    let parsed: { reply?: unknown; action?: unknown; actions?: unknown };
    try {
      parsed = JSON.parse(responseText) as { reply?: unknown; action?: unknown; actions?: unknown };
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]) as { reply?: unknown; action?: unknown; actions?: unknown };
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
        : "Sure thing!";

    // Support both "actions" array (new) and "action" single object (legacy)
    if (Array.isArray(parsed.actions) && parsed.actions.length > 0) {
      actions = parsed.actions.filter(
        (a): a is Record<string, unknown> => a != null && typeof a === "object" && typeof (a as Record<string, unknown>).type === "string",
      );
      if (actions.length === 0) actions = undefined;
    } else if (parsed.action && typeof parsed.action === "object") {
      actions = [parsed.action as Record<string, unknown>];
    }

    // Lie detection: if the reply claims changes were made but no actions were emitted
    const CLAIMS_ACTION = /\b(i('ve| have)\s+(created|added|set|updated|changed|removed|deleted|renamed|duplicated)|created\s+.+for you|done!|got it[.!]|here you go|made the change|changes? (were |have been )?made|all set|set .+ to \d|added .+ (to|for)|removed .+ from|deleted|renamed .+ to)\b/i;
    if (!actions && CLAIMS_ACTION.test(reply)) {
      // The AI lied — claimed it did something but emitted no actions. Retry once.
      try {
        const retryResult = await chat.sendMessage(
          "SYSTEM ERROR: Your previous reply claimed you made changes but you included NO actions array. This is not allowed. You MUST include the \"actions\" array with actual action objects, or honestly say you cannot do it. Respond again with correct JSON.",
        );
        const retryText = retryResult.response.text();
        let retryParsed: { reply?: unknown; action?: unknown; actions?: unknown };
        try {
          retryParsed = JSON.parse(retryText) as { reply?: unknown; action?: unknown; actions?: unknown };
        } catch {
          const retryMatch = retryText.match(/\{[\s\S]*\}/);
          if (retryMatch) {
            try {
              retryParsed = JSON.parse(retryMatch[0]) as { reply?: unknown; action?: unknown; actions?: unknown };
            } catch {
              retryParsed = {};
            }
          } else {
            retryParsed = {};
          }
        }

        if (typeof retryParsed.reply === "string" && retryParsed.reply.trim()) {
          reply = retryParsed.reply.trim();
        }
        if (Array.isArray(retryParsed.actions) && retryParsed.actions.length > 0) {
          actions = (retryParsed.actions as Record<string, unknown>[]).filter(
            (a): a is Record<string, unknown> => a != null && typeof a === "object" && typeof a.type === "string",
          );
          if (actions.length === 0) actions = undefined;
        } else if (retryParsed.action && typeof retryParsed.action === "object") {
          actions = [retryParsed.action as Record<string, unknown>];
        }
      } catch {
        // Retry failed, fall through to honesty rewrite
      }

      // If still no actions after retry, force an honest reply
      if (!actions) {
        reply = "I wasn't able to make those changes. Could you try rephrasing your request?";
      }
    }
  } catch (err) {
    console.error("[chat] Gemini error:", err);
    return NextResponse.json(
      { error: "Service error. Please try again." },
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

  return NextResponse.json({ reply, actions });
}
