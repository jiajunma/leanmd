import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildEntryContextBundle, buildEntryReviewBundle } from "./context.js";
import type { Registry } from "./registry.js";
import { buildRegistry } from "./registry.js";

export interface GraphData {
  nodes: Array<{
    id: string;
    kind: string;
    title: string;
    cluster: string;
    status: string;
  }>;
  edges: Array<{
    from: string;
    to: string;
    source: "informal" | "formal";
  }>;
}

export function buildGraphData(registry: Registry): GraphData {
  const nodes = registry.entries.map((entry) => ({
    id: entry.document.frontMatter.id,
    kind: entry.document.frontMatter.kind,
    title: entry.document.frontMatter.title,
    cluster: entry.document.frontMatter.cluster,
    status: entry.computedStatus,
  }));

  const edges = registry.entries.flatMap((entry) => {
    const from = entry.document.frontMatter.id;
    const informal = entry.document.frontMatter.depends_on.informal.map((to) => ({
      from,
      to,
      source: "informal" as const,
    }));
    const formal = entry.document.frontMatter.depends_on.formal.map((to) => ({
      from,
      to,
      source: "formal" as const,
    }));
    return [...informal, ...formal];
  });

  return { nodes, edges };
}

export function buildRegistryData(registry: Registry) {
  return registry.entries.map((entry) => ({
    id: entry.document.frontMatter.id,
    title: entry.document.frontMatter.title,
    kind: entry.document.frontMatter.kind,
    cluster: entry.document.frontMatter.cluster,
    status: entry.computedStatus,
  }));
}

export function buildStatusData(registry: Registry) {
  return registry.entries.map((entry) => ({
    id: entry.document.frontMatter.id,
    status: entry.computedStatus,
    blocked_by: entry.blockedBy,
    active_sorry_count: entry.activeSorryCount,
  }));
}

export async function exportProject(rootDir: string, outDir: string): Promise<Registry> {
  const registry = await buildRegistry(rootDir);
  const contextDir = path.join(outDir, "entry-context");
  const reviewDir = path.join(outDir, "entry-review");
  await mkdir(outDir, { recursive: true });
  await mkdir(contextDir, { recursive: true });
  await mkdir(reviewDir, { recursive: true });

  await writeFile(path.join(outDir, "registry.json"), JSON.stringify(buildRegistryData(registry), null, 2), "utf-8");
  await writeFile(path.join(outDir, "status.json"), JSON.stringify(buildStatusData(registry), null, 2), "utf-8");
  await writeFile(path.join(outDir, "dep-graph.json"), JSON.stringify(buildGraphData(registry), null, 2), "utf-8");

  for (const entry of registry.entries) {
    const fileName = `${entry.document.frontMatter.id}.json`.replaceAll("/", "_").replaceAll(":", "_");
    await writeFile(
      path.join(contextDir, fileName),
      JSON.stringify(buildEntryContextBundle(registry, entry.document.frontMatter.id), null, 2),
      "utf-8",
    );
    await writeFile(
      path.join(reviewDir, fileName),
      JSON.stringify(buildEntryReviewBundle(registry, entry.document.frontMatter.id), null, 2),
      "utf-8",
    );
  }

  return registry;
}
