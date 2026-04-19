import { buildBenchmarkDiffSummary, type BenchmarkDiffSummary } from "./benchmark-diff.js";
import { buildBenchmarkReport } from "./benchmark-report.js";
import type { BenchmarkProject } from "./types.js";

export interface BenchmarkDiffReport {
  benchmark: BenchmarkProject;
  summary: BenchmarkDiffSummary;
}

export async function buildBenchmarkDiffReport(
  benchmarksDir: string,
  benchmarkId: string,
  blueprintPath: string,
  projectRoot: string,
): Promise<BenchmarkDiffReport> {
  const report = await buildBenchmarkReport(benchmarksDir, benchmarkId, blueprintPath, projectRoot);
  return {
    benchmark: report.benchmark,
    summary: buildBenchmarkDiffSummary(report.comparison),
  };
}
