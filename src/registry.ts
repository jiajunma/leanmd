import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { countActiveSorryInFile, fileExists } from "./lean.js";
import {
  type FormalDependencyProviderName,
  restrictFormalDependenciesToKnownIds,
  resolveFormalDependencyProvider,
} from "./lsp.js";
import { parseEntryDocument, parseOverviewDocument } from "./markdown.js";
import type {
  EntryStatus,
  ParsedEntryDocument,
  ParsedOverviewDocument,
} from "./types.js";

export const REQUIRED_ENTRY_SECTIONS = [
  "Informal statement",
  "Assumptions",
  "Conclusion",
  "Proof outline",
  "Key dependencies",
  "Formalization notes",
  "Open gaps",
] as const;

export interface RegistryEntry {
  document: ParsedEntryDocument;
  computedStatus: EntryStatus;
  usedBy: string[];
  blockedBy: string[];
  activeSorryCount: number | null;
}

export interface Registry {
  rootDir: string;
  overview: ParsedOverviewDocument;
  entries: RegistryEntry[];
  byId: Map<string, RegistryEntry>;
  formalDependencyProvider: FormalDependencyProviderName;
}

export interface CheckIssue {
  level: "error" | "warning";
  path: string;
  message: string;
}

export interface RegistryCheckResult {
  registry: Registry;
  issues: CheckIssue[];
}

async function walkMarkdownFiles(rootDir: string): Promise<string[]> {
  const results: string[] = [];

  async function visit(dir: string): Promise<void> {
    const items = await readdir(dir, { withFileTypes: true });
    for (const item of items) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) {
        if (item.name === "node_modules" || item.name === "dist" || item.name.startsWith(".")) {
          continue;
        }
        await visit(full);
      } else if (item.isFile() && item.name.endsWith(".md")) {
        results.push(full);
      }
    }
  }

  await visit(rootDir);
  return results.sort();
}

async function loadOverview(rootDir: string): Promise<ParsedOverviewDocument> {
  const overviewPath = path.join(rootDir, "overview.md");
  const content = await readFile(overviewPath, "utf-8");
  return parseOverviewDocument(overviewPath, content);
}

async function loadEntries(rootDir: string): Promise<ParsedEntryDocument[]> {
  const allMarkdown = await walkMarkdownFiles(rootDir);
  const entryPaths = allMarkdown.filter((file) => path.basename(file) !== "overview.md");
  const entries: ParsedEntryDocument[] = [];

  for (const entryPath of entryPaths) {
    const content = await readFile(entryPath, "utf-8");
    entries.push(parseEntryDocument(entryPath, content));
  }

  return entries;
}

function computeUsedBy(entries: ParsedEntryDocument[]): Map<string, string[]> {
  const byId = new Map(entries.map((entry) => [entry.frontMatter.id, entry]));
  const usedBy = new Map<string, string[]>();

  for (const entry of entries) {
    const refs = new Set([
      ...entry.frontMatter.depends_on.informal,
      ...entry.frontMatter.depends_on.formal,
    ]);
    for (const ref of refs) {
      if (!byId.has(ref)) {
        continue;
      }
      const list = usedBy.get(ref) ?? [];
      list.push(entry.frontMatter.id);
      usedBy.set(ref, list);
    }
  }

  for (const value of usedBy.values()) {
    value.sort();
  }

  return usedBy;
}

function computeBlockedBy(
  entries: ParsedEntryDocument[],
  statuses: Map<string, EntryStatus>,
): Map<string, string[]> {
  const blockedBy = new Map<string, string[]>();

  for (const entry of entries) {
    const blockers = entry.frontMatter.depends_on.formal.filter((depId) => {
      const depStatus = statuses.get(depId);
      if (!depStatus) {
        return false;
      }
      return depStatus === "missing" || depStatus === "incomplete";
    });
    blockedBy.set(entry.frontMatter.id, blockers);
  }

  return blockedBy;
}

async function computeBaseStatus(
  entry: ParsedEntryDocument,
  rootDir: string,
): Promise<{ status: EntryStatus; activeSorryCount: number | null }> {
  const lean = entry.frontMatter.lean;
  if (!lean || !lean.main_file) {
    return { status: "missing", activeSorryCount: null };
  }

  const fullPath = path.isAbsolute(lean.main_file) ? lean.main_file : path.join(rootDir, lean.main_file);
  if (!(await fileExists(fullPath))) {
    return { status: "missing", activeSorryCount: null };
  }

  const activeSorryCount = await countActiveSorryInFile(fullPath);
  if (activeSorryCount > 0) {
    return { status: "incomplete", activeSorryCount };
  }

  return { status: "formalized", activeSorryCount: 0 };
}

function computeStatus(
  baseStatus: EntryStatus,
  blockedBy: string[],
): EntryStatus {
  if (baseStatus === "missing" || baseStatus === "incomplete") {
    return baseStatus;
  }
  if (blockedBy.length > 0) {
    return "blocked";
  }
  return baseStatus;
}

export async function buildRegistry(rootDir: string): Promise<Registry> {
  const overview = await loadOverview(rootDir);
  const provider = await resolveFormalDependencyProvider(rootDir);
  const [entryDocs, rawFormalOverrides] = await Promise.all([
    loadEntries(rootDir),
    provider.load(rootDir),
  ]);
  const formalOverrides = restrictFormalDependenciesToKnownIds(
    rawFormalOverrides,
    entryDocs.map((document) => document.frontMatter.id),
  );
  const normalizedDocs = entryDocs.map((document) => {
    const override = formalOverrides[document.frontMatter.id];
    if (!override) {
      return document;
    }
    return {
      ...document,
      frontMatter: {
        ...document.frontMatter,
        depends_on: {
          ...document.frontMatter.depends_on,
          formal: override,
        },
      },
    };
  });
  const byId = new Map<string, RegistryEntry>();
  const usedByMap = computeUsedBy(normalizedDocs);
  const baseStatuses = new Map<string, EntryStatus>();
  const activeSorryCounts = new Map<string, number | null>();

  await Promise.all(
    normalizedDocs.map(async (document) => {
      const { status, activeSorryCount } = await computeBaseStatus(document, rootDir);
      baseStatuses.set(document.frontMatter.id, status);
      activeSorryCounts.set(document.frontMatter.id, activeSorryCount);
    }),
  );

  const blockedByMap = computeBlockedBy(normalizedDocs, baseStatuses);

  const entries = normalizedDocs.map((document) => {
    const usedBy = usedByMap.get(document.frontMatter.id) ?? [];
    const blockedBy = blockedByMap.get(document.frontMatter.id) ?? [];
    const computedStatus = computeStatus(baseStatuses.get(document.frontMatter.id) ?? "missing", blockedBy);
    const entry: RegistryEntry = {
      document,
      computedStatus,
      usedBy,
      blockedBy,
      activeSorryCount: activeSorryCounts.get(document.frontMatter.id) ?? null,
    };
    byId.set(document.frontMatter.id, entry);
    return entry;
  });

  return {
    rootDir,
    overview,
    entries,
    byId,
    formalDependencyProvider: provider.name,
  };
}

function pushIssue(
  issues: CheckIssue[],
  level: "error" | "warning",
  pathName: string,
  message: string,
): void {
  issues.push({ level, path: pathName, message });
}

export async function checkRegistry(rootDir: string): Promise<RegistryCheckResult> {
  const registry = await buildRegistry(rootDir);
  const issues: CheckIssue[] = [];
  const seen = new Set<string>();

  for (const entry of registry.entries) {
    const entryPath = entry.document.path;
    const id = entry.document.frontMatter.id;

    if (seen.has(id)) {
      pushIssue(issues, "error", entryPath, `Duplicate entry id '${id}'.`);
    }
    seen.add(id);

    for (const section of REQUIRED_ENTRY_SECTIONS) {
      if (!(section in entry.document.sections)) {
        pushIssue(issues, "error", entryPath, `Missing required section '${section}'.`);
      }
    }

    if ((entry.document.sections["Key dependencies"] ?? "").trim() === "") {
      pushIssue(issues, "warning", entryPath, "Key dependencies section is empty.");
    }

    for (const depId of entry.document.frontMatter.depends_on.informal) {
      if (!registry.byId.has(depId)) {
        pushIssue(
          issues,
          "warning",
          entryPath,
          `Unknown informal dependency '${depId}'.`,
        );
      }
    }

    for (const depId of entry.document.frontMatter.depends_on.formal) {
      if (!registry.byId.has(depId)) {
        pushIssue(
          issues,
          "warning",
          entryPath,
          `Unknown formal dependency '${depId}'.`,
        );
      }
    }

    if (entry.document.frontMatter.lean) {
      const { main_file, main_decl } = entry.document.frontMatter.lean;
      if (main_file !== undefined && !main_file.trim()) {
        pushIssue(issues, "error", entryPath, "Lean binding requires a non-empty main_file.");
      }
      if (main_decl !== undefined && !main_decl.trim()) {
        pushIssue(issues, "error", entryPath, "Lean binding requires a non-empty main_decl.");
      }
      if (main_file) {
        const fullPath = path.isAbsolute(main_file) ? main_file : path.join(rootDir, main_file);
        if (!(await fileExists(fullPath))) {
          pushIssue(issues, "error", entryPath, `Lean main_file does not exist: '${main_file}'.`);
        }
      }
    }
  }

  for (const featured of registry.overview.frontMatter.featured_entries ?? []) {
    if (!registry.byId.has(featured)) {
      pushIssue(
        issues,
        "warning",
        registry.overview.path,
        `Featured entry '${featured}' was not found.`,
      );
    }
  }

  return { registry, issues };
}
