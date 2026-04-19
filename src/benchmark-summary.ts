import { readFile } from "node:fs/promises";
import path from "node:path";

export interface BenchmarkSummaryReport {
  benchmark_id: string;
  timing_comparison: {
    our_pipeline_ms: number | null;
    leanblueprint_web_ms: number | null;
    speedup_factor: number | null;
  };
  structure_comparison: {
    entry_count_difference: number;
    missing_entry_count_in_target: number;
    missing_entry_count_in_source: number;
    informal_edge_count_difference: number;
    missing_informal_edge_count_in_target: number;
    missing_informal_edge_count_in_source: number;
  };
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export async function buildBenchmarkSummaryReport(benchmarkId: string): Promise<BenchmarkSummaryReport> {
  const base = path.join("benchmarks", "reports");
  const [ourPipeline, leanblueprintWeb, diffSummary] = await Promise.all([
    readJson<any>(path.join(base, `${benchmarkId}-our-pipeline.json`)),
    readJson<any>(path.join(base, `${benchmarkId}-leanblueprint-web.json`)),
    readJson<any>(path.join(base, `${benchmarkId}-diff-summary.json`)),
  ]);

  const ourMs = ourPipeline?.timings_ms?.total ?? null;
  const bpMs = leanblueprintWeb?.timings_ms?.total ?? null;
  const speedup =
    typeof ourMs === "number" && typeof bpMs === "number" && ourMs > 0
      ? bpMs / ourMs
      : null;

  return {
    benchmark_id: benchmarkId,
    timing_comparison: {
      our_pipeline_ms: ourMs,
      leanblueprint_web_ms: bpMs,
      speedup_factor: speedup,
    },
    structure_comparison: {
      entry_count_difference: diffSummary?.summary?.entry_count_difference ?? 0,
      missing_entry_count_in_target: diffSummary?.summary?.missing_entry_count_in_target ?? 0,
      missing_entry_count_in_source: diffSummary?.summary?.missing_entry_count_in_source ?? 0,
      informal_edge_count_difference: diffSummary?.summary?.informal_edge_count_difference ?? 0,
      missing_informal_edge_count_in_target:
        diffSummary?.summary?.missing_informal_edge_count_in_target ?? 0,
      missing_informal_edge_count_in_source:
        diffSummary?.summary?.missing_informal_edge_count_in_source ?? 0,
    },
  };
}
