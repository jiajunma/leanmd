import type { Registry, RegistryEntry } from "./registry.js";
import { buildRegistry } from "./registry.js";

export interface EntryContextBundle {
  id: string;
  title: string;
  kind: string;
  cluster: string;
  status: string;
  blocked_by: string[];
  lean?: {
    main_file?: string;
    main_decl?: string;
  };
  sections: {
    informal_statement: string;
    assumptions: string;
    conclusion: string;
    proof_outline: string;
    key_dependencies: string;
    formalization_notes: string;
    open_gaps: string;
  };
  depends_on: {
    informal: string[];
    formal: string[];
  };
  used_by: string[];
  active_sorry_count: number | null;
}

export interface EntryReviewBundle extends EntryContextBundle {
  issues: {
    warnings: string[];
    errors: string[];
  };
}

function getEntry(registry: Registry, entryId: string): RegistryEntry {
  const entry = registry.byId.get(entryId);
  if (!entry) {
    throw new Error(`Unknown entry '${entryId}'.`);
  }
  return entry;
}

export function buildEntryContextBundle(registry: Registry, entryId: string): EntryContextBundle {
  const entry = getEntry(registry, entryId);
  const sections = entry.document.sections;

  return {
    id: entry.document.frontMatter.id,
    title: entry.document.frontMatter.title,
    kind: entry.document.frontMatter.kind,
    cluster: entry.document.frontMatter.cluster,
    status: entry.computedStatus,
    blocked_by: entry.blockedBy,
    lean: entry.document.frontMatter.lean,
    sections: {
      informal_statement: sections["Informal statement"] ?? "",
      assumptions: sections["Assumptions"] ?? "",
      conclusion: sections["Conclusion"] ?? "",
      proof_outline: sections["Proof outline"] ?? "",
      key_dependencies: sections["Key dependencies"] ?? "",
      formalization_notes: sections["Formalization notes"] ?? "",
      open_gaps: sections["Open gaps"] ?? "",
    },
    depends_on: entry.document.frontMatter.depends_on,
    used_by: entry.usedBy,
    active_sorry_count: entry.activeSorryCount,
  };
}

export function buildEntryReviewBundle(registry: Registry, entryId: string): EntryReviewBundle {
  const base = buildEntryContextBundle(registry, entryId);
  const warnings: string[] = [];
  const errors: string[] = [];

  if (base.sections.key_dependencies.trim() === "") {
    warnings.push("Key dependencies section is empty.");
  }

  for (const dep of base.depends_on.informal) {
    if (!registry.byId.has(dep)) {
      warnings.push(`Unknown informal dependency '${dep}'.`);
    }
  }

  for (const dep of base.depends_on.formal) {
    if (!registry.byId.has(dep)) {
      warnings.push(`Unknown formal dependency '${dep}'.`);
    }
  }

  return {
    ...base,
    issues: { warnings, errors },
  };
}

export async function loadEntryContextBundle(rootDir: string, entryId: string): Promise<EntryContextBundle> {
  const registry = await buildRegistry(rootDir);
  return buildEntryContextBundle(registry, entryId);
}

export async function loadEntryReviewBundle(rootDir: string, entryId: string): Promise<EntryReviewBundle> {
  const registry = await buildRegistry(rootDir);
  return buildEntryReviewBundle(registry, entryId);
}
