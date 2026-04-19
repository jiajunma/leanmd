import type { ComparisonSummary } from "./compare.js";

export interface BenchmarkDiffSummary {
  entry_count_difference: number;
  missing_entry_count_in_target: number;
  missing_entry_count_in_source: number;
  informal_edge_count_difference: number;
  missing_informal_edge_count_in_target: number;
  missing_informal_edge_count_in_source: number;
  kind_count_differences: Record<string, number>;
  sample_missing_entries_in_target: string[];
  sample_missing_entries_in_source: string[];
  sample_missing_informal_edges_in_target: Array<[string, string]>;
  sample_missing_informal_edges_in_source: Array<[string, string]>;
}

export function buildBenchmarkDiffSummary(comparison: ComparisonSummary): BenchmarkDiffSummary {
  const kinds = new Set([
    ...Object.keys(comparison.kind_counts.source),
    ...Object.keys(comparison.kind_counts.target),
  ]);
  const kind_count_differences: Record<string, number> = {};

  for (const kind of kinds) {
    kind_count_differences[kind] =
      (comparison.kind_counts.target[kind] ?? 0) - (comparison.kind_counts.source[kind] ?? 0);
  }

  return {
    entry_count_difference: comparison.target_entry_count - comparison.source_entry_count,
    missing_entry_count_in_target: comparison.missing_in_target.length,
    missing_entry_count_in_source: comparison.missing_in_source.length,
    informal_edge_count_difference:
      comparison.informal_edges.target_count - comparison.informal_edges.source_count,
    missing_informal_edge_count_in_target: comparison.informal_edges.missing_in_target.length,
    missing_informal_edge_count_in_source: comparison.informal_edges.missing_in_source.length,
    kind_count_differences,
    sample_missing_entries_in_target: comparison.missing_in_target.slice(0, 10),
    sample_missing_entries_in_source: comparison.missing_in_source.slice(0, 10),
    sample_missing_informal_edges_in_target: comparison.informal_edges.missing_in_target.slice(0, 10),
    sample_missing_informal_edges_in_source: comparison.informal_edges.missing_in_source.slice(0, 10),
  };
}
