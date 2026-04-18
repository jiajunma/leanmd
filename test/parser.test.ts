import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { cp, mkdtemp, readdir, readFile as readOutputFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadBenchmarkById, loadBenchmarks } from "../src/benchmarks.js";
import { buildBenchmarkReport } from "../src/benchmark-report.js";
import { migrateBlueprintFile, migrateBlueprintPath, writeMigratedEntries } from "../src/blueprint.js";
import { compareBlueprintPathToProject } from "../src/compare.js";
import { buildEntryContextBundle, buildEntryReviewBundle } from "../src/context.js";
import { exportProject } from "../src/export.js";
import { countActiveSorry } from "../src/lean.js";
import { loadFormalDependencyOverrides } from "../src/lsp.js";
import { parseEntryDocument, parseOverviewDocument } from "../src/markdown.js";
import { buildSite } from "../src/render.js";
import { checkRegistry } from "../src/registry.js";
import { loadSyncPreview, syncWrite } from "../src/sync.js";

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

test("migrate blueprint directory input", async () => {
  const entries = await migrateBlueprintPath("test/fixtures/blueprint");
  assert.equal(entries.length, 2);
  const theorem = entries.find((entry) => entry.id === "thm:sylow_exists");
  assert.ok(theorem);
  assert.equal(theorem.cluster, "blueprint");
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

test("build standalone site output", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "leanmd-site-"));
  const registry = await buildSite("test/fixtures/project", outDir);
  assert.equal(registry.entries.length, 2);
  const generated = (await readdir(path.join(outDir, "generated"))).sort();
  assert.deepEqual(generated, ["dep-graph.json", "entry-context", "entry-review", "registry.json", "status.json"]);
  const indexHtml = await readOutputFile(path.join(outDir, "index.html"), "utf-8");
  assert.match(indexHtml, /Demo Project/);
  assert.match(indexHtml, /Open dependency graph/);
  const graphHtml = await readOutputFile(path.join(outDir, "graph.html"), "utf-8");
  assert.match(graphHtml, /Dependency Graph/);
  const entryHtml = await readOutputFile(path.join(outDir, "entries", "thm_sylow_exists.html"), "utf-8");
  assert.match(entryHtml, /Sylow existence/);
  assert.match(entryHtml, /status: <strong>blocked<\/strong>/);
  const reviewFiles = (await readdir(path.join(outDir, "generated", "entry-review"))).sort();
  assert.deepEqual(reviewFiles, ["def_p_group.json", "thm_sylow_exists.json"]);
});

test("load benchmark manifests", async () => {
  const benchmarks = await loadBenchmarks("benchmarks");
  assert.ok(benchmarks.length >= 1);
  const pfr = await loadBenchmarkById("benchmarks", "pfr");
  assert.equal(pfr.title, "PFR Conjecture");
  assert.match(pfr.published_blueprint, /teorth\.github\.io\/pfr\/blueprint/);
});

test("load formal dependency overrides", async () => {
  const overrides = await loadFormalDependencyOverrides("test/fixtures/project");
  assert.deepEqual(overrides["thm:sylow_exists"], ["def:p_group"]);
});

test("export machine-readable project artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "leanmd-export-"));
  const registry = await exportProject("test/fixtures/project", outDir);
  assert.equal(registry.entries.length, 2);
  const files = (await readdir(outDir)).sort();
  assert.deepEqual(files, ["dep-graph.json", "entry-context", "entry-review", "registry.json", "status.json"]);
  const graphJson = await readOutputFile(path.join(outDir, "dep-graph.json"), "utf-8");
  assert.match(graphJson, /"source": "informal"/);
  assert.match(graphJson, /"source": "formal"/);
  const contextFiles = (await readdir(path.join(outDir, "entry-context"))).sort();
  assert.deepEqual(contextFiles, ["def_p_group.json", "thm_sylow_exists.json"]);
  const reviewJson = await readOutputFile(
    path.join(outDir, "entry-review", "thm_sylow_exists.json"),
    "utf-8",
  );
  assert.match(reviewJson, /"blocked_by": \[/);
});

test("build entry context and review bundles", async () => {
  const result = await checkRegistry("test/fixtures/project");
  const context = buildEntryContextBundle(result.registry, "thm:sylow_exists");
  assert.equal(context.id, "thm:sylow_exists");
  assert.equal(context.status, "blocked");
  assert.deepEqual(context.blocked_by, ["def:p_group"]);
  assert.match(context.sections.proof_outline, /Reduce to a counting argument/);

  const review = buildEntryReviewBundle(result.registry, "thm:sylow_exists");
  assert.equal(review.issues.errors.length, 0);
  assert.equal(review.issues.warnings.length, 0);
});

test("compare migrated blueprint entries to project registry", async () => {
  const summary = await compareBlueprintPathToProject("test/fixtures/blueprint", "test/fixtures/project");
  assert.equal(summary.source_entry_count, 2);
  assert.equal(summary.target_entry_count, 2);
  assert.deepEqual(summary.missing_in_target, []);
  assert.deepEqual(summary.missing_in_source, []);
  assert.equal(summary.kind_counts.source.theorem, 1);
  assert.equal(summary.kind_counts.target.definition, 1);
});

test("build benchmark report", async () => {
  const report = await buildBenchmarkReport(
    "benchmarks",
    "pfr",
    "test/fixtures/blueprint",
    "test/fixtures/project",
  );
  assert.equal(report.benchmark.id, "pfr");
  assert.equal(report.comparison.source_entry_count, 2);
  assert.deepEqual(report.comparison.missing_in_target, []);
});

test("build sync preview", async () => {
  const preview = await loadSyncPreview("test/fixtures/project");
  const theorem = preview.find((entry) => entry.id === "thm:sylow_exists");
  assert.ok(theorem);
  assert.equal(theorem.generated.computed_status, "blocked");
  assert.deepEqual(theorem.generated.blocked_by, ["def:p_group"]);
  assert.deepEqual(theorem.generated.formal_dependencies, ["def:p_group"]);
});

test("sync-write updates generated metadata in entry front matter", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "leanmd-sync-write-"));
  await cp("test/fixtures/project", tempRoot, { recursive: true });

  const targetEntry = path.join(tempRoot, "entries", "sylow_exists.md");
  const original = await readOutputFile(targetEntry, "utf-8");
  const modified = original.replace("  formal: []", "  formal:\n    - thm:wrong_dep");
  await writeFile(targetEntry, modified, "utf-8");

  await syncWrite(tempRoot);
  const synced = await readOutputFile(targetEntry, "utf-8");
  assert.match(synced, /formal:\n    - def:p_group/);
  assert.match(synced, /used_by:\n  \[\]/);
  assert.match(synced, /blocked_by:\n  - def:p_group/);
});
