import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SYLLABUS_IMPORT_ENABLED } from "../lib/feature-flags";

test("syllabus import remains disabled while deprecated", () => {
  assert.equal(SYLLABUS_IMPORT_ENABLED, false);
});

test("syllabus API rejects requests before auth and parsing", () => {
  const route = readFileSync("app/api/syllabus/route.ts", "utf8");
  const featureGuard = route.indexOf("if (!SYLLABUS_IMPORT_ENABLED)");
  const authCheck = route.indexOf("getServerSession(authOptions)");
  const formParsing = route.indexOf("req.formData()");

  assert.notEqual(featureGuard, -1);
  assert.ok(featureGuard < authCheck);
  assert.ok(featureGuard < formParsing);
  assert.match(route, /code: "FEATURE_DEPRECATED"/);
  assert.match(route, /status: 410/);
});
