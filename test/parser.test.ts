import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseEntryDocument, parseOverviewDocument } from "../src/markdown.js";
import { checkRegistry } from "../src/registry.js";

test("parse entry document", async () => {
  const content = await readFile("test/fixtures/entries/sample-entry.md", "utf-8");
  const parsed = parseEntryDocument("test/fixtures/entries/sample-entry.md", content);
  assert.equal(parsed.frontMatter.id, "thm:sylow_exists");
  assert.equal(parsed.frontMatter.cluster, "sylow");
  assert.deepEqual(parsed.frontMatter.depends_on.informal, ["def:p_group", "thm:orbit_stabilizer"]);
  assert.equal(parsed.sections["Proof outline"], "Reduce to a counting argument using a group action.");
});

test("parse overview document", async () => {
  const content = await readFile("test/fixtures/overview.md", "utf-8");
  const parsed = parseOverviewDocument("test/fixtures/overview.md", content);
  assert.equal(parsed.frontMatter.project_id, "pfr");
  assert.deepEqual(parsed.frontMatter.main_clusters, ["additive-combinatorics"]);
  assert.equal(parsed.sections["Introduction"], "This project studies a structured family of arguments.");
});

test("build registry and derive reverse dependencies and blocked status", async () => {
  const result = await checkRegistry("test/fixtures/project");
  assert.equal(result.issues.filter((issue) => issue.level === "error").length, 0);

  const byId = new Map(result.registry.entries.map((entry) => [entry.document.frontMatter.id, entry]));
  const theorem = byId.get("thm:sylow_exists");
  const definition = byId.get("def:p_group");

  assert.ok(theorem);
  assert.ok(definition);
  assert.deepEqual(theorem.usedBy, []);
  assert.deepEqual(theorem.blockedBy, ["def:p_group"]);
  assert.equal(theorem.computedStatus, "blocked");
  assert.deepEqual(definition.usedBy, ["thm:sylow_exists"]);
});
