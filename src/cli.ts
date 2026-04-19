#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import process from "node:process";
import { buildBenchmarkReport } from "./benchmark-report.js";
import { loadBenchmarkById, loadBenchmarks } from "./benchmarks.js";
import { runBenchmarkPipeline } from "./benchmark-run.js";
import { migrateBlueprintPath, writeMigratedEntries } from "./blueprint.js";
import { compareBlueprintPathToProject } from "./compare.js";
import { loadEntryContextBundle, loadEntryReviewBundle } from "./context.js";
import { exportProject } from "./export.js";
import { materializeBenchmarkProject } from "./materialize.js";
import { parseEntryDocument, parseOverviewDocument } from "./markdown.js";
import { buildSite } from "./render.js";
import { checkRegistry } from "./registry.js";
import { loadSyncPreview, syncWrite } from "./sync.js";

async function main(): Promise<void> {
  const [, , command, target, maybeOutDir, ...rest] = process.argv;

  if (!command || !target) {
    console.error("Usage: leanmd <entry|overview|check|sync|sync-write|context|review|export|build|migrate-blueprint|compare-blueprint|benchmarks|benchmark|benchmark-report|materialize-benchmark|benchmark-run> <path> [arg]");
    process.exitCode = 1;
    return;
  }

  if (command === "entry") {
    const content = await readFile(target, "utf-8");
    const parsed = parseEntryDocument(target, content);
    console.log(JSON.stringify(parsed, null, 2));
    return;
  }

  if (command === "overview") {
    const content = await readFile(target, "utf-8");
    const parsed = parseOverviewDocument(target, content);
    console.log(JSON.stringify(parsed, null, 2));
    return;
  }

  if (command === "check") {
    const result = await checkRegistry(target);
    console.log(
      JSON.stringify(
        {
          overview: result.registry.overview.frontMatter,
          entries: result.registry.entries.map((entry) => ({
            id: entry.document.frontMatter.id,
            status: entry.computedStatus,
            used_by: entry.usedBy,
            blocked_by: entry.blockedBy,
          })),
          issues: result.issues,
        },
        null,
        2,
      ),
    );
    if (result.issues.some((issue) => issue.level === "error")) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "sync") {
    const preview = await loadSyncPreview(target);
    console.log(JSON.stringify(preview, null, 2));
    return;
  }

  if (command === "sync-write") {
    const preview = await syncWrite(target);
    console.log(JSON.stringify(preview, null, 2));
    return;
  }

  if (command === "context") {
    if (!maybeOutDir) {
      console.error("Usage: leanmd context <project-root> <entry-id>");
      process.exitCode = 1;
      return;
    }
    const bundle = await loadEntryContextBundle(target, maybeOutDir);
    console.log(JSON.stringify(bundle, null, 2));
    return;
  }

  if (command === "review") {
    if (!maybeOutDir) {
      console.error("Usage: leanmd review <project-root> <entry-id>");
      process.exitCode = 1;
      return;
    }
    const bundle = await loadEntryReviewBundle(target, maybeOutDir);
    console.log(JSON.stringify(bundle, null, 2));
    return;
  }

  if (command === "migrate-blueprint") {
    if (!maybeOutDir) {
      console.error("Usage: leanmd migrate-blueprint <tex-file-or-dir> <out-dir>");
      process.exitCode = 1;
      return;
    }
    const entries = await migrateBlueprintPath(target);
    await writeMigratedEntries(maybeOutDir, entries);
    console.log(
      JSON.stringify(
        entries.map((entry) => ({
          id: entry.id,
          kind: entry.kind,
          status: entry.status,
          depends_on: entry.depends_on.informal,
        })),
        null,
        2,
      ),
    );
    return;
  }

  if (command === "compare-blueprint") {
    if (!maybeOutDir) {
      console.error("Usage: leanmd compare-blueprint <blueprint-tex-or-dir> <project-root>");
      process.exitCode = 1;
      return;
    }
    const summary = await compareBlueprintPathToProject(target, maybeOutDir);
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (command === "build") {
    if (!maybeOutDir) {
      console.error("Usage: leanmd build <project-root> <out-dir>");
      process.exitCode = 1;
      return;
    }
    const registry = await buildSite(target, maybeOutDir);
    console.log(
      JSON.stringify(
        {
          overview: registry.overview.frontMatter.title,
          entry_count: registry.entries.length,
          out_dir: maybeOutDir,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (command === "export") {
    if (!maybeOutDir) {
      console.error("Usage: leanmd export <project-root> <out-dir>");
      process.exitCode = 1;
      return;
    }
    const registry = await exportProject(target, maybeOutDir);
    console.log(
      JSON.stringify(
        {
          overview: registry.overview.frontMatter.title,
          entry_count: registry.entries.length,
          out_dir: maybeOutDir,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (command === "benchmarks") {
    const benchmarks = await loadBenchmarks(target);
    console.log(JSON.stringify(benchmarks, null, 2));
    return;
  }

  if (command === "benchmark") {
    if (!maybeOutDir) {
      console.error("Usage: leanmd benchmark <benchmarks-dir> <benchmark-id>");
      process.exitCode = 1;
      return;
    }
    const benchmark = await loadBenchmarkById(target, maybeOutDir);
    console.log(JSON.stringify(benchmark, null, 2));
    return;
  }

  if (command === "benchmark-report") {
    const [blueprintPath, projectRoot] = rest;
    if (!maybeOutDir || !blueprintPath || !projectRoot) {
      console.error("Usage: leanmd benchmark-report <benchmarks-dir> <benchmark-id> <blueprint-path> <project-root>");
      process.exitCode = 1;
      return;
    }
    const report = await buildBenchmarkReport(target, maybeOutDir, blueprintPath, projectRoot);
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (command === "materialize-benchmark") {
    const [blueprintPath, outputRoot] = rest;
    if (!maybeOutDir || !blueprintPath || !outputRoot) {
      console.error("Usage: leanmd materialize-benchmark <benchmarks-dir> <benchmark-id> <blueprint-path> <out-dir>");
      process.exitCode = 1;
      return;
    }
    const result = await materializeBenchmarkProject(target, maybeOutDir, blueprintPath, outputRoot);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "benchmark-run") {
    const [blueprintPath, outputRoot] = rest;
    if (!maybeOutDir || !blueprintPath) {
      console.error("Usage: leanmd benchmark-run <benchmarks-dir> <benchmark-id> <blueprint-path> [out-root]");
      process.exitCode = 1;
      return;
    }
    const report = await runBenchmarkPipeline(target, maybeOutDir, blueprintPath, outputRoot);
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.error(`Unknown command '${command}'.`);
  process.exitCode = 1;
}

void main();
