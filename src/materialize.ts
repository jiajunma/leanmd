import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BenchmarkProject } from "./types.js";
import type { MigratedEntry } from "./blueprint.js";
import { migrateBlueprintPath, writeMigratedEntries } from "./blueprint.js";
import { loadBenchmarkById } from "./benchmarks.js";

function slug(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "_");
}

function overviewContent(benchmark: BenchmarkProject, entries: MigratedEntry[]): string {
  const clusters = [...new Set(entries.map((entry) => entry.cluster))].sort();
  const featured = entries
    .filter((entry) => entry.kind === "theorem" || entry.kind === "definition")
    .slice(0, 12)
    .map((entry) => entry.id);

  const clusterYaml =
    clusters.length > 0 ? clusters.map((cluster) => `  - ${cluster}`).join("\n") : "  []";
  const featuredYaml =
    featured.length > 0 ? featured.map((entryId) => `  - ${entryId}`).join("\n") : "  []";

  return `---
project_id: ${benchmark.id}
kind: overview
title: ${benchmark.title}
subtitle: Migrated benchmark project
main_clusters:
${clusterYaml}
featured_entries:
${featuredYaml}
status: incomplete
---

# Introduction

This overview was generated from the published benchmark blueprint source.

# Roadmap

- Start from the dependency graph.
- Inspect clusters for local organization.
- Inspect entries for migrated statements and proof outlines.

# Benchmark Metadata

- Source repository: ${benchmark.repository}
- Published blueprint: ${benchmark.published_blueprint}
`;
}

export interface MaterializedBenchmarkProject {
  benchmark: BenchmarkProject;
  outputRoot: string;
  entryCount: number;
  clusters: string[];
}

export async function materializeBenchmarkProject(
  benchmarksDir: string,
  benchmarkId: string,
  blueprintPath: string,
  outDir: string,
): Promise<MaterializedBenchmarkProject> {
  const benchmark = await loadBenchmarkById(benchmarksDir, benchmarkId);
  const entries = await migrateBlueprintPath(blueprintPath);
  const entriesDir = path.join(outDir, "entries");

  await mkdir(entriesDir, { recursive: true });
  await writeFile(path.join(outDir, "overview.md"), overviewContent(benchmark, entries), "utf-8");
  await writeMigratedEntries(entriesDir, entries);

  return {
    benchmark,
    outputRoot: outDir,
    entryCount: entries.length,
    clusters: [...new Set(entries.map((entry) => entry.cluster))].sort(),
  };
}
