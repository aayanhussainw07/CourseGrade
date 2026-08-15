import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  BackendBodyTooLargeError,
  isAllowedBackendProxyRequest,
  readBackendRequestBody,
} from "../lib/backend-proxy-security";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

test("generic proxy exposes only supported user-facing routes", () => {
  assert.equal(isAllowedBackendProxyRequest(["semesters"], "GET"), true);
  assert.equal(
    isAllowedBackendProxyRequest(["semesters", "12", "duplicate"], "POST"),
    true,
  );
  assert.equal(isAllowedBackendProxyRequest(["settings"], "PUT"), true);
  assert.equal(isAllowedBackendProxyRequest(["grade-scales", "2"], "PATCH"), true);

  assert.equal(isAllowedBackendProxyRequest(["ai-calls"], "POST"), false);
  assert.equal(isAllowedBackendProxyRequest(["admin", "stats"], "GET"), false);
  assert.equal(isAllowedBackendProxyRequest(["feedback"], "GET"), false);
  assert.equal(isAllowedBackendProxyRequest(["semesters"], "PUT"), false);
});

test("generic proxy rejects request bodies above its byte limit", async () => {
  const accepted = new Request("https://coursegrade.test", {
    method: "POST",
    body: "1234",
  });
  const acceptedBody = await readBackendRequestBody(accepted, 4);
  assert.ok(acceptedBody);
  assert.equal(Buffer.from(acceptedBody).toString(), "1234");

  const rejected = new Request("https://coursegrade.test", {
    method: "POST",
    body: "12345",
  });
  await assert.rejects(
    readBackendRequestBody(rejected, 4),
    BackendBodyTooLargeError,
  );
});

test("Flask refuses to start without an explicit internal secret", () => {
  const environment = { ...process.env };
  delete environment.INTERNAL_API_SECRET;
  delete environment.FLASK_ENV;
  delete environment.ENV;

  const missing = spawnSync("python3", ["-c", "import config"], {
    cwd: join(repositoryRoot, "backend"),
    env: environment,
    encoding: "utf8",
  });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /INTERNAL_API_SECRET is required/);

  const configured = spawnSync("python3", ["-c", "import config"], {
    cwd: join(repositoryRoot, "backend"),
    env: {
      ...environment,
      INTERNAL_API_SECRET: "test-only-random-secret-with-32-chars",
    },
    encoding: "utf8",
  });
  assert.equal(configured.status, 0, configured.stderr);
});

test("corrective migration restricts syllabus quota objects to service_role", () => {
  assert.equal(
    existsSync(
      join(
        repositoryRoot,
        "backend/supabase/migrations/20260429000000_syllabus_rate_limit.sql",
      ),
    ),
    false,
  );

  const sql = readFileSync(
    join(
      repositoryRoot,
      "supabase/migrations/20260812202536_fix_roster_security_and_filtering.sql",
    ),
    "utf8",
  ).toLowerCase();

  assert.match(sql, /syllabus_rate_limits enable row level security/);
  assert.match(
    sql,
    /revoke all on function public\.consume_syllabus_import\(text, text, integer\)[\s\S]*from public, anon, authenticated/,
  );
  assert.match(
    sql,
    /grant execute on function public\.consume_syllabus_import\(text, text, integer\)[\s\S]*to service_role/,
  );
  assert.match(sql, /security invoker[\s\S]*set search_path = ''/);
});

test("backend applies explicit request and assignment cardinality limits", () => {
  const source = readFileSync(join(repositoryRoot, "backend/routes.py"), "utf8");
  const config = readFileSync(join(repositoryRoot, "backend/config.py"), "utf8");

  assert.match(config, /MAX_CONTENT_LENGTH = MAX_BACKEND_BODY_BYTES/);
  assert.match(source, /len\(assignment_seeds_payload\) > MAX_ASSIGNMENTS_PER_COURSE/);
});
