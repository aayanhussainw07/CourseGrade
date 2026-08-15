import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { syncRoster } from "../lib/cornell-sync";
import type { CornellCourse, Roster, Subject } from "../lib/cornell-roster";

type Operation = {
  table: string;
  action: "upsert" | "select" | "delete";
  filters: Array<[string, string, unknown]>;
};

class FakeQuery implements PromiseLike<{ data: unknown; error: null }> {
  constructor(
    private readonly operation: Operation,
    private readonly data: unknown = null,
  ) {}

  eq(column: string, value: unknown) {
    this.operation.filters.push(["eq", column, value]);
    return this;
  }

  lt(column: string, value: unknown) {
    this.operation.filters.push(["lt", column, value]);
    return this;
  }

  in(column: string, value: unknown) {
    this.operation.filters.push(["in", column, value]);
    return this;
  }

  then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve({ data: this.data, error: null }).then(
      onfulfilled,
      onrejected,
    );
  }
}

function fakeSupabase(storedSubjects: string[] = []) {
  const operations: Operation[] = [];
  const client = {
    from(table: string) {
      return {
        async upsert() {
          operations.push({ table, action: "upsert", filters: [] });
          return { error: null };
        },
        select() {
          const operation: Operation = { table, action: "select", filters: [] };
          operations.push(operation);
          return new FakeQuery(
            operation,
            table === "cornell_subjects"
              ? storedSubjects.map((code) => ({ code }))
              : [],
          );
        },
        delete() {
          const operation: Operation = { table, action: "delete", filters: [] };
          operations.push(operation);
          return new FakeQuery(operation);
        },
      };
    },
  };
  return { client: client as unknown as SupabaseClient, operations };
}

const roster: Roster = {
  code: "FA26",
  descr: "Fall 2026",
  year: 2026,
  term: "FA",
  isActive: true,
};

const subjects: Subject[] = [
  { code: "A", descr: "A" },
  { code: "B", descr: "B" },
  { code: "C", descr: "C" },
];

function course(subject: string): CornellCourse {
  return {
    subject,
    catalogNbr: "1000",
    codeNorm: `${subject.toLowerCase()}1000`,
    titleLong: "Course",
    titleShort: "Course",
    description: null,
    creditsMin: 3,
    creditsMax: 3,
    gradingBasis: null,
    prereqs: null,
    distrReqs: null,
    acadCareer: null,
    instructors: [],
  };
}

test("sync stops at the first failed subject without advancing progress", async () => {
  const { client } = fakeSupabase();
  const fetched: string[] = [];
  const progressed: string[] = [];

  const result = await syncRoster(client, roster, {
    stopOnError: true,
    source: {
      async getSubjects() {
        return subjects;
      },
      async getClasses(_roster, subject) {
        fetched.push(subject);
        if (subject === "B") throw new Error("upstream failed");
        return [course(subject)];
      },
    },
    onProgress(progress) {
      progressed.push(progress.subject);
    },
  });

  assert.deepEqual(fetched, ["A", "B"]);
  assert.deepEqual(progressed, ["A"]);
  assert.equal(result.subjects, 1);
  assert.equal(result.errors.length, 1);
});

test("successful sync reconciles removed courses and subjects", async () => {
  const { client, operations } = fakeSupabase(["A", "OLD"]);

  const result = await syncRoster(client, roster, {
    source: {
      async getSubjects() {
        return [{ code: "A", descr: "A" }];
      },
      async getClasses() {
        return [course("A")];
      },
    },
  });

  assert.deepEqual(result.errors, []);
  const staleCourses = operations.find(
    (operation) =>
      operation.table === "cornell_courses" && operation.action === "delete",
  );
  assert.ok(staleCourses?.filters.some(([kind]) => kind === "lt"));

  const staleSubjects = operations.find(
    (operation) =>
      operation.table === "cornell_subjects" && operation.action === "delete",
  );
  assert.deepEqual(staleSubjects?.filters.at(-1), ["in", "code", ["OLD"]]);
});

test("a removed checkpoint subject restarts safely instead of skipping", async () => {
  const { client } = fakeSupabase();
  const fetched: string[] = [];

  await syncRoster(client, roster, {
    resumeAfterSubject: "REMOVED",
    onlySubject: "A",
    source: {
      async getSubjects() {
        return subjects;
      },
      async getClasses(_roster, subject) {
        fetched.push(subject);
        return [course(subject)];
      },
    },
  });

  assert.deepEqual(fetched, ["A"]);
});
