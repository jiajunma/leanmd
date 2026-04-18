import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface MigratedEntry {
  id: string;
  kind: "definition" | "lemma" | "proposition" | "theorem" | "corollary";
  title: string;
  cluster: string;
  status: "missing" | "incomplete" | "formalized";
  depends_on: {
    informal: string[];
    formal: string[];
  };
  used_by: string[];
  blocked_by: string[];
  lean?: {
    main_decl: string;
  };
  statement: string;
  proofOutline: string;
  sourcePath: string;
}

const ENTRY_RE =
  /\\begin\{(definition|lemma|proposition|theorem|corollary)\}(?:\[(.*?)\])?([\s\S]*?)\\end\{\1\}/g;
const PROOF_RE = /^\s*\\begin\{proof\}([\s\S]*?)\\end\{proof\}/;

function extractCommandValues(name: string, text: string): string[] {
  const re = new RegExp(String.raw`\\${name}\{([^}]*)\}`, "g");
  const values: string[] = [];
  for (const match of text.matchAll(re)) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    for (const piece of raw.split(",")) {
      const value = piece.trim();
      if (value) values.push(value);
    }
  }
  return values;
}

function stripBlueprintCommands(text: string): string {
  return text
    .replace(/\\label\{[^}]*\}/g, "")
    .replace(/\\lean\{[^}]*\}/g, "")
    .replace(/\\uses\{[^}]*\}/g, "")
    .replace(/\\leanok\b/g, "")
    .replace(/\\mathlibok\b/g, "")
    .replace(/\\notready\b/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function inferTitle(id: string, kind: string): string {
  const tail = id.split(":").at(-1) ?? kind;
  const text = tail.replace(/[_-]+/g, " ").trim();
  return text ? text[0].toUpperCase() + text.slice(1) : kind;
}

function inferStatus(body: string, proofBody: string, leanDecls: string[]): "missing" | "incomplete" | "formalized" {
  if (/\b\\leanok\b/.test(body) || /\b\\leanok\b/.test(proofBody)) {
    return "formalized";
  }
  if (leanDecls.length > 0) {
    return "incomplete";
  }
  return "missing";
}

function outputFilename(id: string): string {
  return `${(id.split(":").at(-1) ?? id).replace(/[^A-Za-z0-9._-]+/g, "_")}.md`;
}

function renderEntry(entry: MigratedEntry): string {
  const lines: string[] = [
    "---",
    `id: ${entry.id}`,
    `kind: ${entry.kind}`,
    `title: ${entry.title}`,
    `cluster: ${entry.cluster}`,
    `status: ${entry.status}`,
    "depends_on:",
    "  informal:",
    ...(entry.depends_on.informal.length > 0
      ? entry.depends_on.informal.map((dep) => `    - ${dep}`)
      : ["    []"]),
    "  formal:",
    ...(entry.depends_on.formal.length > 0
      ? entry.depends_on.formal.map((dep) => `    - ${dep}`)
      : ["    []"]),
    "used_by:",
    ...(entry.used_by.length > 0 ? entry.used_by.map((dep) => `  - ${dep}`) : ["  []"]),
    "blocked_by:",
    ...(entry.blocked_by.length > 0 ? entry.blocked_by.map((dep) => `  - ${dep}`) : ["  []"]),
  ];

  if (entry.lean) {
    lines.push("lean:", `  main_decl: ${entry.lean.main_decl}`);
  }

  lines.push(
    "---",
    "",
    "# Informal statement",
    "",
    entry.statement || "_TODO_",
    "",
    "# Assumptions",
    "",
    "_TODO_",
    "",
    "# Conclusion",
    "",
    "_TODO_",
    "",
    "# Proof outline",
    "",
    entry.proofOutline || "_TODO_",
    "",
    "# Key dependencies",
    "",
    ...(entry.depends_on.informal.length > 0 ? entry.depends_on.informal.map((dep) => `- ${dep}`) : ["_TODO_"]),
    "",
    "# Formalization notes",
    "",
    `- migrated from \`${entry.sourcePath}\``,
    "",
    "# Open gaps",
    "",
    "_TODO_",
    "",
  );

  return lines.join("\n");
}

export async function migrateBlueprintFile(
  sourcePath: string,
  clusterOverride?: string,
): Promise<MigratedEntry[]> {
  const content = await readFile(sourcePath, "utf-8");
  const entries: MigratedEntry[] = [];
  const cluster = clusterOverride ?? path.basename(sourcePath, path.extname(sourcePath));

  for (const match of content.matchAll(ENTRY_RE)) {
    const kind = match[1] as MigratedEntry["kind"];
    const title = match[2]?.trim() || "";
    const body = match[3] ?? "";
    const labels = extractCommandValues("label", body);
    if (labels.length === 0) {
      continue;
    }

    const tail = content.slice(match.index! + match[0].length);
    const proofMatch = tail.match(PROOF_RE);
    const proofBody = proofMatch?.[1] ?? "";

    const leanDecls = extractCommandValues("lean", body);
    const informalDeps = Array.from(
      new Set([...extractCommandValues("uses", body), ...extractCommandValues("uses", proofBody)]),
    );

    entries.push({
      id: labels[0]!,
      kind,
      title: title || inferTitle(labels[0]!, kind),
      cluster,
      status: inferStatus(body, proofBody, leanDecls),
      depends_on: {
        informal: informalDeps,
        formal: [],
      },
      used_by: [],
      blocked_by: [],
      lean: leanDecls[0] ? { main_decl: leanDecls[0] } : undefined,
      statement: stripBlueprintCommands(body),
      proofOutline: stripBlueprintCommands(proofBody),
      sourcePath,
    });
  }

  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  for (const entry of entries) {
    for (const dep of entry.depends_on.informal) {
      const target = byId.get(dep);
      if (target) {
        target.used_by.push(entry.id);
      }
    }
  }
  for (const entry of entries) {
    entry.used_by.sort();
  }

  return entries;
}

async function collectTexFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(dir: string): Promise<void> {
    const items = await readdir(dir, { withFileTypes: true });
    for (const item of items) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) {
        await walk(full);
      } else if (item.isFile() && item.name.endsWith(".tex")) {
        files.push(full);
      }
    }
  }

  await walk(root);
  files.sort();
  return files;
}

export async function migrateBlueprintPath(
  sourcePath: string,
  clusterOverride?: string,
): Promise<MigratedEntry[]> {
  const stat = await import("node:fs/promises").then((fs) => fs.stat(sourcePath));
  const sourceFiles = stat.isDirectory() ? await collectTexFiles(sourcePath) : [sourcePath];
  const all: MigratedEntry[] = [];

  for (const file of sourceFiles) {
    const cluster =
      clusterOverride ??
      path.basename(path.dirname(file)) ??
      path.basename(file, path.extname(file));
    const entries = await migrateBlueprintFile(file, cluster);
    all.push(...entries);
  }

  const byId = new Map<string, MigratedEntry>();
  for (const entry of all) {
    byId.set(entry.id, entry);
  }
  for (const entry of all) {
    entry.used_by = [];
  }
  for (const entry of all) {
    for (const dep of entry.depends_on.informal) {
      const target = byId.get(dep);
      if (target) {
        target.used_by.push(entry.id);
      }
    }
  }
  for (const entry of all) {
    entry.used_by.sort();
  }

  return all;
}

export async function writeMigratedEntries(outDir: string, entries: MigratedEntry[]): Promise<void> {
  await mkdir(outDir, { recursive: true });
  for (const entry of entries) {
    const target = path.join(outDir, outputFilename(entry.id));
    await writeFile(target, renderEntry(entry), "utf-8");
  }
}
