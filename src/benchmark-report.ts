import { loadBenchmarkById } from "./benchmarks.js";
import { compareBlueprintPathToProject, type ComparisonSummary } from "./compare.js";
import type { BenchmarkProject } from "./types.js";

export interface BenchmarkReport {
  benchmark: BenchmarkProject;
  comparison: ComparisonSummary;
}

export async function buildBenchmarkReport(
  benchmarksDir: string,
  benchmarkId: string,
  blueprintPath: string,
  projectRoot: string,
): Promise<BenchmarkReport> {
  const [benchmark, comparison] = await Promise.all([
    loadBenchmarkById(benchmarksDir, benchmarkId),
    compareBlueprintPathToProject(blueprintPath, projectRoot),
  ]);

  return {
    benchmark,
    comparison,
  };
}
