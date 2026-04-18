import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mkdtemp, readdir, readFile as readOutputFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { migrateBlueprintFile, writeMigratedEntries } from "../src/blueprint.js";
import { countActiveSorry } from "../src/lean.js";
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
  assert.equal(theorem.activeSorryCount, 0);
  assert.equal(definition.activeSorryCount, 1);
});

test("migrate blueprint tex into entry markdown files", async () => {
  const entries = await migrateBlueprintFile("test/fixtures/blueprint/sample.tex");
  assert.equal(entries.length, 2);
  const theorem = entries.find((entry) => entry.id === "thm:sylow_exists");
  assert.ok(theorem);
  assert.equal(theorem.kind, "theorem");
  assert.deepEqual(theorem.depends_on.informal, ["def:p_group"]);
  assert.equal(theorem.lean?.main_decl, "MyProject.GroupTheory.sylow_exists");

  const outDir = await mkdtemp(path.join(os.tmpdir(), "leanmd-blueprint-"));
  await writeMigratedEntries(outDir, entries);
  const files = (await readdir(outDir)).sort();
  assert.deepEqual(files, ["p_group.md", "sylow_exists.md"]);
  const migrated = await readOutputFile(path.join(outDir, "sylow_exists.md"), "utf-8");
  assert.match(migrated, /depends_on:/);
  assert.match(migrated, /main_decl: MyProject\.GroupTheory\.sylow_exists/);
  assert.match(migrated, /# Proof outline/);
});

test("count active sorry excludes comments and strings", () => {
  const content = `
-- sorry in a line comment
/- sorry in a block comment -/
def hello := "sorry in a string"
theorem t : True := by
  sorry
`;
  assert.equal(countActiveSorry(content), 1);
});
