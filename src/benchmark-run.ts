import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { buildBenchmarkReport } from "./benchmark-report.js";
import { materializeBenchmarkProject } from "./materialize.js";
import { buildSite } from "./render.js";

export interface BenchmarkRunReport {
  benchmark_id: string;
  output_root: string;
  timings_ms: {
    materialize: number;
    build: number;
    compare: number;
    total: number;
  };
  counts: {
    entries: number;
    clusters: number;
  };
  comparison: Awaited<ReturnType<typeof buildBenchmarkReport>>["comparison"];
}

export async function runBenchmarkPipeline(
  benchmarksDir: string,
  benchmarkId: string,
  blueprintPath: string,
  outRoot?: string,
): Promise<BenchmarkRunReport> {
  const baseOut =
    outRoot ??
    path.join(os.tmpdir(), `leanmd-benchmark-${benchmarkId}-${Date.now().toString(36)}`);
  const materializedRoot = path.join(baseOut, "materialized");
  const siteRoot = path.join(baseOut, "site");
  await mkdir(baseOut, { recursive: true });

  const t0 = performance.now();
  const materialized = await materializeBenchmarkProject(
    benchmarksDir,
    benchmarkId,
    blueprintPath,
    materializedRoot,
  );
  const t1 = performance.now();

  await buildSite(materializedRoot, siteRoot);
  const t2 = performance.now();

  const report = await buildBenchmarkReport(
    benchmarksDir,
    benchmarkId,
    blueprintPath,
    materializedRoot,
  );
  const t3 = performance.now();

  return {
    benchmark_id: benchmarkId,
    output_root: baseOut,
    timings_ms: {
      materialize: t1 - t0,
      build: t2 - t1,
      compare: t3 - t2,
      total: t3 - t0,
    },
    counts: {
      entries: materialized.entryCount,
      clusters: materialized.clusters.length,
    },
    comparison: report.comparison,
  };
}
