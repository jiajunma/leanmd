import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
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
}

export interface Registry {
  rootDir: string;
  overview: ParsedOverviewDocument;
  entries: RegistryEntry[];
  byId: Map<string, RegistryEntry>;
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

function computeBlockedBy(entries: ParsedEntryDocument[]): Map<string, string[]> {
  const byId = new Map(entries.map((entry) => [entry.frontMatter.id, entry]));
  const blockedBy = new Map<string, string[]>();

  for (const entry of entries) {
    const blockers = entry.frontMatter.depends_on.formal.filter((depId) => {
      const dep = byId.get(depId);
      if (!dep) {
        return false;
      }
      return dep.frontMatter.status === "missing" || dep.frontMatter.status === "incomplete";
    });
    blockedBy.set(entry.frontMatter.id, blockers);
  }

  return blockedBy;
}

function computeStatus(
  entry: ParsedEntryDocument,
  blockedBy: string[],
): EntryStatus {
  if (entry.frontMatter.status === "missing" || entry.frontMatter.status === "incomplete") {
    return entry.frontMatter.status;
  }
  if (blockedBy.length > 0) {
    return "blocked";
  }
  return entry.frontMatter.status;
}

export async function buildRegistry(rootDir: string): Promise<Registry> {
  const overview = await loadOverview(rootDir);
  const entryDocs = await loadEntries(rootDir);
  const byId = new Map<string, RegistryEntry>();
  const usedByMap = computeUsedBy(entryDocs);
  const blockedByMap = computeBlockedBy(entryDocs);

  const entries = entryDocs.map((document) => {
    const usedBy = usedByMap.get(document.frontMatter.id) ?? [];
    const blockedBy = blockedByMap.get(document.frontMatter.id) ?? [];
    const computedStatus = computeStatus(document, blockedBy);
    const entry: RegistryEntry = {
      document,
      computedStatus,
      usedBy,
      blockedBy,
    };
    byId.set(document.frontMatter.id, entry);
    return entry;
  });

  return {
    rootDir,
    overview,
    entries,
    byId,
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
      if (!main_file.trim()) {
        pushIssue(issues, "error", entryPath, "Lean binding requires a non-empty main_file.");
      }
      if (!main_decl.trim()) {
        pushIssue(issues, "error", entryPath, "Lean binding requires a non-empty main_decl.");
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
