import type { MigratedEntry } from "./blueprint.js";
import { migrateBlueprintPath } from "./blueprint.js";
import type { Registry } from "./registry.js";
import { buildRegistry } from "./registry.js";

export interface ComparisonSummary {
  source_entry_count: number;
  target_entry_count: number;
  source_ids: string[];
  target_ids: string[];
  missing_in_target: string[];
  missing_in_source: string[];
  kind_counts: {
    source: Record<string, number>;
    target: Record<string, number>;
  };
  informal_edges: {
    source_count: number;
    target_count: number;
    missing_in_target: Array<[string, string]>;
    missing_in_source: Array<[string, string]>;
  };
}

function countKindsFromMigrated(entries: MigratedEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    counts[entry.kind] = (counts[entry.kind] ?? 0) + 1;
  }
  return counts;
}

function countKindsFromRegistry(registry: Registry): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of registry.entries) {
    const kind = entry.document.frontMatter.kind;
    counts[kind] = (counts[kind] ?? 0) + 1;
  }
  return counts;
}

export function compareMigratedEntriesToRegistry(
  migrated: MigratedEntry[],
  registry: Registry,
): ComparisonSummary {
  const sourceIds = migrated.map((entry) => entry.id).sort();
  const targetIds = registry.entries.map((entry) => entry.document.frontMatter.id).sort();
  const targetSet = new Set(targetIds);
  const sourceSet = new Set(sourceIds);
  const sourceEdges = migrated.flatMap((entry) =>
    entry.depends_on.informal.map((dep) => [entry.id, dep] as [string, string]),
  );
  const targetEdges = registry.entries.flatMap((entry) =>
    entry.document.frontMatter.depends_on.informal.map((dep) => [entry.document.frontMatter.id, dep] as [string, string]),
  );
  const sourceEdgeKeys = new Set(sourceEdges.map(([from, to]) => `${from}=>${to}`));
  const targetEdgeKeys = new Set(targetEdges.map(([from, to]) => `${from}=>${to}`));

  return {
    source_entry_count: sourceIds.length,
    target_entry_count: targetIds.length,
    source_ids: sourceIds,
    target_ids: targetIds,
    missing_in_target: sourceIds.filter((id) => !targetSet.has(id)),
    missing_in_source: targetIds.filter((id) => !sourceSet.has(id)),
    kind_counts: {
      source: countKindsFromMigrated(migrated),
      target: countKindsFromRegistry(registry),
    },
    informal_edges: {
      source_count: sourceEdges.length,
      target_count: targetEdges.length,
      missing_in_target: sourceEdges.filter(([from, to]) => !targetEdgeKeys.has(`${from}=>${to}`)),
      missing_in_source: targetEdges.filter(([from, to]) => !sourceEdgeKeys.has(`${from}=>${to}`)),
    },
  };
}

export async function compareBlueprintPathToProject(
  blueprintPath: string,
  projectRoot: string,
): Promise<ComparisonSummary> {
  const [migrated, registry] = await Promise.all([
    migrateBlueprintPath(blueprintPath),
    buildRegistry(projectRoot),
  ]);
  return compareMigratedEntriesToRegistry(migrated, registry);
}
