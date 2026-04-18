import type { Registry } from "./registry.js";
import { buildRegistry } from "./registry.js";

export interface EntrySyncPreview {
  id: string;
  path: string;
  generated: {
    used_by: string[];
    blocked_by: string[];
    formal_dependencies: string[];
    computed_status: string;
  };
}

export function buildSyncPreview(registry: Registry): EntrySyncPreview[] {
  return registry.entries.map((entry) => ({
    id: entry.document.frontMatter.id,
    path: entry.document.path,
    generated: {
      used_by: entry.usedBy,
      blocked_by: entry.blockedBy,
      formal_dependencies: entry.document.frontMatter.depends_on.formal,
      computed_status: entry.computedStatus,
    },
  }));
}

export async function loadSyncPreview(rootDir: string): Promise<EntrySyncPreview[]> {
  const registry = await buildRegistry(rootDir);
  return buildSyncPreview(registry);
}
