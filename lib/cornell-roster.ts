// Cornell Class Roster API client. Official JSON API, GET only, <=1 req/sec.
// Base: https://classes.cornell.edu/api/2.0/<method>.json
// Isomorphic: used by the local backfill script and the Vercel Cron refresh route.

const BASE_URL = "https://classes.cornell.edu/api/2.0";
const MIN_SPACING_MS = 1050; // 1 req/sec limit + safety margin
const MAX_RETRIES = 4;
const USER_AGENT = "CourseGrade/1.0 (+https://coursegrade; taskflowdev1@gmail.com)";

export type Roster = {
  code: string; // 'FA25'
  descr: string; // 'Fall 2025'
  year: number;
  term: string; // 'FA' | 'SP' | 'SU' | 'WI'
  isActive: boolean;
};

export type Subject = {
  code: string; // 'CS'
  descr: string;
};

export type CornellCourse = {
  subject: string;
  catalogNbr: string;
  codeNorm: string; // 'cs2110'
  titleLong: string | null;
  titleShort: string | null;
  description: string | null;
  creditsMin: number | null;
  creditsMax: number | null;
  gradingBasis: string | null;
  prereqs: string | null;
  distrReqs: string | null;
  acadCareer: string | null;
  instructors: string[];
};

// ---- raw API shapes (only the fields we read) ----
type RawRoster = { slug: string; descr: string; isDefaultRoster?: string };
type RawSubject = { value: string; descr: string };
type RawInstructor = { firstName?: string; lastName?: string; netid?: string };
type RawMeeting = { instructors?: RawInstructor[] };
type RawSection = { ssrComponent?: string; meetings?: RawMeeting[] };

// Components taught by actual professors. Discussion/lab/recitation (DIS/LAB/REC)
// are section TAs; independent study/research (IND/RSC) list every advisor.
const PRIMARY_COMPONENTS = new Set(["LEC", "SEM", "STU"]);
type RawEnrollGroup = {
  classSections?: RawSection[];
  unitsMinimum?: number;
  unitsMaximum?: number;
  gradingBasisLong?: string;
};
type RawClass = {
  subject: string;
  catalogNbr: string;
  titleLong?: string;
  titleShort?: string;
  description?: string;
  catalogPrereqCoreq?: string | null;
  catalogPrereq?: string | null;
  catalogDistr?: string | null;
  catalogBreadth?: string | null;
  acadCareer?: string | null;
  enrollGroups?: RawEnrollGroup[];
};

// ---- throttle: module-level gate so all callers share the 1 req/sec budget ----
let lastRequestAt = 0;
let chain: Promise<void> = Promise.resolve();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttledGet<T>(path: string): Promise<T> {
  // Serialize requests through a promise chain, spacing each by MIN_SPACING_MS.
  const run = chain.then(async () => {
    const wait = MIN_SPACING_MS - (Date.now() - lastRequestAt);
    if (wait > 0) await delay(wait);
    lastRequestAt = Date.now();
  });
  chain = run.catch(() => {});
  await run;

  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      });
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`HTTP ${res.status}`);
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} (non-retryable)`);
      }
      const json = (await res.json()) as { status?: string; data?: T };
      if (json.status && json.status !== "success") {
        throw new Error(`API status: ${json.status}`);
      }
      return json.data as T;
    } catch (err) {
      lastErr = err;
      // Backoff: 2s, 4s, 8s. Re-space the next request too.
      const backoff = 2000 * 2 ** attempt;
      lastRequestAt = Date.now() + backoff;
      await delay(backoff);
    }
  }
  throw new Error(
    `Cornell API failed after ${MAX_RETRIES} tries for ${path}: ${String(lastErr)}`,
  );
}

export function parseRosterCode(slug: string): { term: string; year: number } {
  const term = slug.slice(0, 2).toUpperCase();
  const yy = Number.parseInt(slug.slice(2), 10);
  // Roster years are 2-digit; all relevant rosters are 2000s.
  const year = Number.isFinite(yy) ? 2000 + yy : 0;
  return { term, year };
}

export async function getRosters(): Promise<Roster[]> {
  const data = await throttledGet<{ rosters: RawRoster[] }>(
    "/config/rosters.json",
  );
  return data.rosters.map((r) => {
    const { term, year } = parseRosterCode(r.slug);
    return {
      code: r.slug,
      descr: r.descr,
      year,
      term,
      isActive: r.isDefaultRoster === "Y",
    };
  });
}

export async function getSubjects(roster: string): Promise<Subject[]> {
  const data = await throttledGet<{ subjects: RawSubject[] }>(
    `/config/subjects.json?roster=${encodeURIComponent(roster)}`,
  );
  return data.subjects.map((s) => ({ code: s.value, descr: s.descr }));
}

export async function getClasses(
  roster: string,
  subject: string,
): Promise<CornellCourse[]> {
  const data = await throttledGet<{ classes: RawClass[] }>(
    `/search/classes.json?roster=${encodeURIComponent(roster)}&subject=${encodeURIComponent(subject)}`,
  );
  return (data.classes ?? []).map(flattenClass);
}

function flattenClass(c: RawClass): CornellCourse {
  const groups = c.enrollGroups ?? [];

  // Credits: range across all enroll groups.
  const mins = groups
    .map((g) => g.unitsMinimum)
    .filter((n): n is number => typeof n === "number");
  const maxs = groups
    .map((g) => g.unitsMaximum)
    .filter((n): n is number => typeof n === "number");
  const creditsMin = mins.length ? Math.min(...mins) : null;
  const creditsMax = maxs.length ? Math.max(...maxs) : null;

  // Instructors: only actual professors (primary teaching sections), deduped.
  // Excludes section TAs (DIS/LAB) and advisor lists (IND/RSC). Empty if none.
  const seen = new Set<string>();
  const instructors: string[] = [];
  for (const g of groups) {
    for (const sec of g.classSections ?? []) {
      if (!PRIMARY_COMPONENTS.has(sec.ssrComponent ?? "")) continue;
      for (const m of sec.meetings ?? []) {
        for (const ins of m.instructors ?? []) {
          const name = `${ins.firstName ?? ""} ${ins.lastName ?? ""}`.trim();
          if (!name) continue;
          const key = ins.netid || name.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          instructors.push(name);
        }
      }
    }
  }

  const gradingBasis = groups.find((g) => g.gradingBasisLong)?.gradingBasisLong;

  return {
    subject: c.subject,
    catalogNbr: c.catalogNbr,
    codeNorm: `${c.subject}${c.catalogNbr}`.toLowerCase().replace(/\s+/g, ""),
    titleLong: c.titleLong ?? null,
    titleShort: c.titleShort ?? null,
    description: c.description ?? null,
    creditsMin,
    creditsMax,
    gradingBasis: gradingBasis ?? null,
    prereqs: c.catalogPrereqCoreq ?? c.catalogPrereq ?? null,
    distrReqs: c.catalogDistr ?? c.catalogBreadth ?? null,
    acadCareer: c.acadCareer ?? null,
    instructors,
  };
}
