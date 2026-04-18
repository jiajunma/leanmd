import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Registry } from "./registry.js";
import { buildRegistry } from "./registry.js";
import { parseEntryDocument } from "./markdown.js";
import { serializeEntryDocument } from "./serialize.js";

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

export async function syncWrite(rootDir: string): Promise<EntrySyncPreview[]> {
  const registry = await buildRegistry(rootDir);

  for (const entry of registry.entries) {
    const content = await readFile(entry.document.path, "utf-8");
    const parsed = parseEntryDocument(entry.document.path, content);
    parsed.frontMatter.depends_on.formal = [...entry.document.frontMatter.depends_on.formal];
    parsed.frontMatter.used_by = [...entry.usedBy];
    parsed.frontMatter.blocked_by = [...entry.blockedBy];
    await writeFile(entry.document.path, serializeEntryDocument(parsed), "utf-8");
  }

  return buildSyncPreview(registry);
}
